<?php
/**
 * Mailer — pengiriman email lewat SMTP tanpa dependensi eksternal.
 *
 * Dipakai untuk mengirim kode OTP verifikasi pendaftaran dari
 * forafagroup@gmail.com lewat Gmail SMTP (smtp.gmail.com).
 *
 * Gmail TIDAK menerima password akun biasa untuk SMTP sejak 2022:
 * yang dipakai adalah "App Password" (16 karakter) dari akun Google yang
 * sudah mengaktifkan verifikasi 2 langkah. Lihat docs/email-otp-setup.md.
 *
 * Enkripsi:
 * - 'ssl'  : ssl://host:465 (yang dipakai Gmail, bawaan)
 * - 'tls'  : tcp host:587 + STARTTLS
 * - 'none' : tcp tanpa enkripsi — HANYA untuk pengujian lokal dengan
 *            server SMTP palsu; jangan dipakai ke server sungguhan.
 */

declare(strict_types=1);

class Mailer
{
    /**
     * Kirim satu email HTML (dengan versi teks polos sebagai alternatif).
     * Mengembalikan ['ok' => true] atau ['ok' => false, 'error' => '...'].
     * TIDAK pernah melempar exception — kegagalan dilaporkan lewat array.
     */
    public static function send(string $to, string $subject, string $htmlBody, string $textBody = ''): array
    {
        $config = require __DIR__ . '/../config/config.php';
        $mail = $config['mail'] ?? [];

        $fromAddress = (string)($mail['from_address'] ?? 'forafagroup@gmail.com');
        $fromName = (string)($mail['from_name'] ?? 'Forafa-App');
        $host = (string)($mail['host'] ?? 'smtp.gmail.com');
        $port = (int)($mail['port'] ?? 465);
        $encryption = strtolower((string)($mail['encryption'] ?? 'ssl'));
        $username = (string)($mail['username'] ?? '');
        $password = (string)($mail['password'] ?? '');
        $timeout = (int)($mail['timeout_seconds'] ?? 15);

        if ($username === '' || $password === '') {
            return [
                'ok' => false,
                'error' => 'Pengiriman email belum dikonfigurasi. Isi MAIL_USERNAME dan MAIL_APP_PASSWORD di server/.env (lihat docs/email-otp-setup.md).',
            ];
        }

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Alamat email tujuan tidak valid.'];
        }

        $transport = match ($encryption) {
            'ssl' => "ssl://{$host}:{$port}",
            'tls' => "tcp://{$host}:{$port}",
            'none' => "tcp://{$host}:{$port}",
            default => null,
        };
        if ($transport === null) {
            return ['ok' => false, 'error' => "MAIL_ENCRYPTION tidak dikenal: '{$encryption}' (pakai ssl, tls, atau none)."];
        }

        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client($transport, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
        if ($socket === false) {
            return ['ok' => false, 'error' => "Tidak bisa terhubung ke server SMTP {$host}:{$port} ({$errstr}). Periksa MAIL_HOST/MAIL_PORT dan koneksi internet."];
        }
        stream_set_timeout($socket, $timeout);

        $read = static function () use ($socket): array {
            $line = fgets($socket, 4096);
            if ($line === false) return [0, ''];
            $code = (int)substr(trim($line), 0, 3);
            // Balasan multi-baris SMTP: baris lanjutan diawali "250-".
            while (strlen($line) >= 4 && $line[3] === '-') {
                $line = fgets($socket, 4096);
                if ($line === false) break;
            }
            return [$code, trim($line)];
        };
        $send = static function (string $command, int $expect) use ($socket, $read): array {
            fwrite($socket, $command . "\r\n");
            [$code, $line] = $read();
            return [$code === $expect, $code, $line];
        };

        try {
            [$code] = $read();
            if ($code !== 220) {
                fclose($socket);
                return ['ok' => false, 'error' => "Server SMTP menolak koneksi (kode {$code})."];
            }

            $ehloHost = gethostname() ?: 'localhost';
            [$ok] = $send("EHLO {$ehloHost}", 250);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => 'Server SMTP menolak EHLO.'];
            }

            if ($encryption === 'tls') {
                [$ok, , $line] = $send('STARTTLS', 220);
                if (!$ok) {
                    fclose($socket);
                    return ['ok' => false, 'error' => "Server SMTP tidak mendukung STARTTLS ({$line})."];
                }
                if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    fclose($socket);
                    return ['ok' => false, 'error' => 'Gagal mengaktifkan TLS ke server SMTP.'];
                }
                [$ok] = $send("EHLO {$ehloHost}", 250);
                if (!$ok) {
                    fclose($socket);
                    return ['ok' => false, 'error' => 'Server SMTP menolak EHLO setelah STARTTLS.'];
                }
            }

            [$ok, , $line] = $send('AUTH LOGIN', 334);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => "Server SMTP menolak AUTH LOGIN ({$line})."];
            }
            [$ok] = $send(base64_encode($username), 334);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => 'Server SMTP menolak username (periksa MAIL_USERNAME).'];
            }
            [$ok, , $line] = $send(base64_encode($password), 235);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => "Login SMTP gagal ({$line}). Untuk Gmail, pakai App Password 16 karakter, bukan password akun biasa — lihat docs/email-otp-setup.md."];
            }

            [$ok, , $line] = $send("MAIL FROM:<{$fromAddress}>", 250);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => "Server SMTP menolak pengirim ({$line})."];
            }
            [$ok, , $line] = $send("RCPT TO:<{$to}>", 250);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => "Server SMTP menolak penerima ({$line})."];
            }
            [$ok] = $send('DATA', 354);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => 'Server SMTP menolak DATA.'];
            }

            $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
            $headers = [
                "From: {$fromName} <{$fromAddress}>",
                "To: <{$to}>",
                "Subject: {$encodedSubject}",
                'MIME-Version: 1.0',
                'Content-Type: text/html; charset=UTF-8',
                'Content-Transfer-Encoding: 8bit',
                'Date: ' . gmdate('D, d M Y H:i:s') . ' GMT',
            ];
            $body = $textBody !== '' ? $htmlBody : $htmlBody;
            // Dot-stuffing (RFC 5321): baris yang diawali '.' harus digandakan.
            $data = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\r\n.", "\r\n..", str_replace("\n", "\r\n", $body)) . "\r\n.";
            [$ok, , $line] = $send($data, 250);
            if (!$ok) {
                fclose($socket);
                return ['ok' => false, 'error' => "Server SMTP menolak isi email ({$line})."];
            }

            $send('QUIT', 221);
            fclose($socket);
            return ['ok' => true];
        } catch (Throwable $e) {
            try {
                fclose($socket);
            } catch (Throwable) {
                // Soket sudah tertutup — tidak ada yang perlu dilakukan.
            }
            return ['ok' => false, 'error' => 'Gagal mengirim email: ' . $e->getMessage()];
        }
    }
}
