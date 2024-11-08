# Contributing to NFT Marketplace Diamond

First off, thank you for considering contributing to NFT Marketplace Diamond! It's people like you that make this project such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Pull Request Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

### Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/nft-marketplace-diamond.git
   cd nft-marketplace-diamond
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up your environment:
   - Copy `.env.example` to `.env`
   - Fill in required environment variables

### Development Workflow

1. **Testing**

   ```bash
   npm run test        # Run all tests
   ```

2. **Linting**

   ```bash
   npm run lint:all    # Check code style
   ```

3. **Compilation**
   ```bash
   npm run compile     # Compile contracts
   ```

### Adding New Features

1. **Adding a New Facet**

   - Create a new file in `contracts/diamond/facets/`
   - Implement the facet interface
   - Add tests in `test/`
   - Update deployment scripts if necessary

   Example structure:

   ```solidity
   // contracts/diamond/facets/NewFacet.sol
   contract NewFacet {
       event NewEvent(...);
       error CustomError();

       function newFunction() external {
           // Implementation
       }
   }
   ```

2. **Modifying Existing Facets**

   - Ensure backward compatibility
   - Update tests accordingly
   - Document changes in the facet's comments

3. **Diamond Cuts**
   - Use the DiamondCutFacet for adding/replacing/removing functions
   - Test all diamond cut operations thoroughly
   - Follow the pattern in `test/DiamondCut.test.js`

### Testing Guidelines

1. **Test Structure**

   - Group tests by facet functionality
   - Use descriptive test names
   - Follow the existing test patterns

   Example:

   ```javascript
   describe('NewFacet', function () {
     describe('Main Functionality', function () {
       it('Should perform expected operation', async function () {
         // Test implementation
       });
     });
   });
   ```

2. **Test Coverage**
   - Aim for 100% coverage
   - Test both success and failure cases
   - Test edge cases and boundary conditions

### Documentation

1. **Code Comments**

   - Use NatSpec format for contract documentation
   - Document all public functions
   - Explain complex logic

2. **README Updates**
   - Update feature documentation
   - Add new deployment instructions if needed
   - Document breaking changes

### Submission Guidelines

1. **Commit Messages**

   - Use clear, descriptive commit messages
   - Reference issues and pull requests
   - Follow conventional commits format

2. **Pull Request Process**

   - Create a feature branch
   - Add tests and documentation
   - Update CHANGELOG.md
   - Request review from maintainers

3. **Code Review**
   - Address review comments
   - Keep discussions focused
   - Be respectful and constructive

### Security Considerations

1. **Smart Contract Security**

   - Follow Solidity best practices
   - Consider reentrancy and other common vulnerabilities
   - Test edge cases thoroughly

2. **Diamond Standard Specifics**
   - Understand diamond storage patterns
   - Test facet interactions
   - Verify selector conflicts

### Getting Help

- Open an issue for bugs
- Join our community Discord for discussions
- Check existing documentation and issues first

### License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to NFT Marketplace Diamond! 🎉
