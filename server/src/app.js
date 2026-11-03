/**
 * Forafa-App Backend Runner & Entry Bridge
 * 
 * Modul backend Forafa-App dibangun menggunakan PHP Native (PDO MySQL/PostgreSQL)
 * sesuai dengan file-file pada direktori src/controllers, src/models, src/middlewares, dan src/routes.
 * 
 * Script ini dapat digunakan untuk menjalankan server PHP via Node.js atau menampilkan instruksi server.
 */

const { spawn } = require('child_process');
const path = require('path');

const serverDir = path.resolve(__dirname, '..');
const port = process.env.PORT || 8000;

console.log('==================================================');
console.log('🚀 Forafa-App — Backend Service');
console.log('==================================================');
console.log(`📡 Menjalankan PHP Development Server pada port ${port}...`);
console.log(`📁 Direktori Server: ${serverDir}`);
console.log('🔗 URL API: http://localhost:' + port + '/api/v1');
console.log('--------------------------------------------------');

const phpServer = spawn('php', ['-S', `0.0.0.0:${port}`, 'router.php'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: true
});

phpServer.on('error', (err) => {
  console.error('❌ Gagal menjalankan server PHP otomatis:', err.message);
  console.log('💡 Jalankan secara manual dari direktori server/:');
  console.log(`   cd server && php -S 0.0.0.0:${port} router.php`);
});

phpServer.on('close', (code) => {
  console.log(`ℹ️ Server berhenti dengan kode ${code}`);
});
