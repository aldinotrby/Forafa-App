# Contributing to Forafa-App

Thank you for your interest in contributing to Forafa-App! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Release Process](#release-process)

## 🤝 Code of Conduct

This project follows a Code of Conduct to ensure a welcoming environment for everyone:

### Our Pledge
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

### Unacceptable Behavior
- Harassment, discrimination, or hate speech
- Trolling, insulting comments, or personal attacks
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** 18.0+ installed
- **Git** for version control
- **Code editor** (VS Code recommended)
- Basic knowledge of React, TypeScript, and Tailwind CSS

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/forafa-app.git
   cd forafa-app
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/forafa-app.git
   ```

## 🛠️ Development Setup

### Initial Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**: `http://localhost:5173`

### Development Tools

Recommended VS Code extensions:
- **ES7+ React/Redux/React-Native snippets**
- **TypeScript Importer**
- **Tailwind CSS IntelliSense**
- **Prettier - Code formatter**
- **ESLint**
- **GitLens**

## 📝 Contribution Guidelines

### Types of Contributions

We welcome contributions in the form of:

- 🐛 **Bug fixes**
- ✨ **New features** 
- 📚 **Documentation improvements**
- 🎨 **UI/UX enhancements**
- ⚡ **Performance optimizations**
- 🔧 **Code refactoring**
- 🧪 **Test coverage**

### Before You Start

1. **Check existing issues** to avoid duplication
2. **Create an issue** for new features or major changes
3. **Discuss your approach** in the issue comments
4. **Wait for approval** before starting work on large features

### Branching Strategy

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development branches
- **bugfix/**: Bug fix branches
- **hotfix/**: Critical production fixes

### Branch Naming Convention

```
feature/add-user-profile
bugfix/fix-login-validation  
hotfix/security-vulnerability
docs/update-readme
refactor/optimize-components
```

## 🎨 Code Style

### TypeScript Guidelines

```typescript
// ✅ Good: Use interfaces for object types
interface User {
  id: string
  name: string
  email: string
}

// ✅ Good: Use descriptive names
const getUserById = (id: string): User | null => { ... }

// ❌ Bad: Avoid any types
const handleData = (data: any) => { ... }

// ✅ Good: Use proper typing
const handleUserData = (data: User) => { ... }
```

### React Component Guidelines

```tsx
// ✅ Good: Use functional components with TypeScript
interface Props {
  title: string
  onSubmit: (data: FormData) => void
  isLoading?: boolean
}

export default function UserForm({ title, onSubmit, isLoading = false }: Props) {
  const [formData, setFormData] = useState<FormData>({})
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Component JSX */}
    </form>
  )
}

// ❌ Bad: Avoid default exports without proper typing
export default function UserForm(props) { ... }
```

### Tailwind CSS Guidelines

```tsx
// ✅ Good: Use semantic class organization
<div className="flex items-center justify-between bg-white rounded-lg shadow-md p-6">
  <h2 className="text-xl font-semibold text-gray-800">Title</h2>
  <Button className="bg-brand hover:bg-brand/90 text-white">
    Action
  </Button>
</div>

// ❌ Bad: Avoid overly long class strings without organization
<div className="flex items-center justify-between bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
```

### File Organization

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Basic UI elements (Button, Input, etc.)
│   ├── forms/          # Form components
│   └── layout/         # Layout components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── constants/          # Application constants
└── styles/             # Global styles
```

### Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Hooks**: camelCase with 'use' prefix (`useUserData.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_ENDPOINTS.ts`)
- **Types**: PascalCase (`UserData.ts`)

## 🧪 Testing

### Current Testing Setup

The project currently uses basic build validation. We plan to add comprehensive testing in future versions.

### Future Testing Strategy

- **Unit tests**: Jest + React Testing Library
- **Integration tests**: Cypress or Playwright
- **Type checking**: TypeScript compiler
- **Linting**: ESLint + Prettier

### Running Tests

```bash
# Type checking
npm run type-check

# Build validation
npm run build

# Future: Unit tests
npm run test

# Future: E2E tests
npm run test:e2e
```

## 🔄 Pull Request Process

### Before Submitting

1. **Update your branch**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Test your changes**:
   ```bash
   npm run build
   npm run type-check
   ```

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add user profile component"
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(auth): add password reset functionality
fix(ui): resolve button alignment issue  
docs(readme): update installation instructions
refactor(store): optimize user data handling
style(css): improve responsive design
test(utils): add validation helper tests
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Pull Request Template

When creating a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Tested locally
- [ ] Build passes
- [ ] TypeScript checks pass

## Screenshots (if applicable)
Include before/after screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if needed
- [ ] No new TypeScript errors
- [ ] Responsive design considered
```

### Review Process

1. **Automated checks** must pass
2. **Code review** by maintainer(s)
3. **Testing** in development environment
4. **Approval** and merge by maintainer

## 🐛 Issue Reporting

### Bug Reports

Use this template for bug reports:

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Windows 11]
- Browser: [e.g. Chrome 120]
- Node.js version: [e.g. 20.10.0]

**Additional context**
Any other context about the problem.
```

### Feature Requests

Use this template for feature requests:

```markdown
**Feature Description**
Clear description of the feature you'd like to see.

**Use Case**
Explain the problem this feature would solve.

**Proposed Solution**
How you envision this feature working.

**Alternatives Considered**
Other solutions you've considered.

**Additional Context**
Screenshots, mockups, or examples.
```

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release branch
4. Final testing
5. Create GitHub release with notes
6. Deploy to production

## 📞 Getting Help

### Communication Channels

- **GitHub Issues**: Technical questions and bugs
- **GitHub Discussions**: General questions and ideas
- **Email**: security@forafa.app (security issues only)

### Response Times

- **Security issues**: Within 24 hours
- **Bug reports**: Within 48 hours  
- **Feature requests**: Within 1 week
- **Questions**: Within 3-5 days

## 🙏 Recognition

Contributors will be recognized in:

- **README.md**: Contributors section
- **CHANGELOG.md**: Release notes
- **GitHub**: Contributor graph and statistics

### Contributor Levels

- **Contributor**: 1+ merged PR
- **Regular Contributor**: 5+ merged PRs
- **Core Contributor**: 20+ merged PRs + ongoing involvement
- **Maintainer**: Repository access and release authority

## 📚 Resources

### Learning Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)

### Project Resources

- [Project Roadmap](https://github.com/yourrepo/forafa-app/projects)
- [API Documentation](https://github.com/yourrepo/forafa-app/wiki/API)
- [Design System](https://github.com/yourrepo/forafa-app/wiki/Design)

---

Thank you for contributing to Forafa-App! Your efforts help make digital participation more accessible and effective for communities everywhere. 🚀