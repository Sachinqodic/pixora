# Implementation Plan: Node.js Application Structure

## Overview

This implementation plan breaks down the Node.js application into discrete coding tasks following a layered architecture approach. The implementation will proceed from foundational setup (project structure, configuration) through core infrastructure (database, security, error handling) to feature implementation (user model, file uploads) and finally integration and testing.

Each task builds incrementally on previous work, ensuring the application remains functional at each checkpoint. Property-based tests are included as optional sub-tasks to validate the 7 correctness properties defined in the design document.

## Tasks

- [x] 1. Initialize project structure and dependencies
  - Create package.json with required dependencies (express, mongoose, dotenv, cors, helmet, express-rate-limit, multer)
  - Create directory structure (config/, constants/, controllers/, middlewares/, models/, routes/, services/, utils/)
  - Create .gitignore file to exclude node_modules and .env
  - Create .env.example file with required environment variable templates
  - _Requirements: 1.1, 1.3, 8.2_

- [x] 2. Implement configuration layer
  - [x] 2.1 Create .env configuration file
    - Define PORT, MONGO_URI, and NODE_ENV variables
    - _Requirements: 1.2_
  - [ ]\* 2.2 Write property test for configuration loading
    - **Property 1: Configuration Loading**
    - **Validates: Requirements 1.2**
  - [x] 2.3 Create database connection module (config/db.js)
    - Implement connectDB() function that reads MONGO_URI from environment
    - Add connection success logging
    - Add connection error handling with process exit
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]\* 2.4 Write property test for database connection
    - **Property 2: Database Connection with Valid Configuration**
    - **Validates: Requirements 2.1**

- [x] 3. Implement security and error handling middleware
  - [x] 3.1 Create security middleware (middlewares/security.js)
    - Implement setupSecurity() function with CORS configuration
    - Add Helmet middleware for secure HTTP headers
    - Add express-rate-limit configuration
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]\* 3.2 Write property test for rate limiting enforcement
    - **Property 3: Rate Limiting Enforcement**
    - **Validates: Requirements 3.3**
  - [x] 3.3 Create error handler middleware (middlewares/errorHandler.js)
    - Implement errorHandler() function with error catching logic
    - Add HTTP status code determination
    - Add JSON error response formatting
    - Add error logging to console
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]\* 3.4 Write property test for comprehensive error handling
    - **Property 4: Comprehensive Error Handling**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 4. Checkpoint - Verify middleware and configuration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement data models
  - [x] 5.1 Create User model (models/User.js)
    - Define Mongoose schema with name, email, profilePicture fields
    - Add email unique index
    - Add field validation (required, unique, format)
    - Enable timestamps for createdAt and updatedAt
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]\* 5.2 Write property test for user model validation
    - **Property 7: User Model Required Field Validation**
    - **Validates: Requirements 7.4**
  - [ ]\* 5.3 Write unit tests for User model
    - Test successful user creation with valid data
    - Test validation errors for missing required fields
    - Test email uniqueness constraint
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 6. Implement file upload functionality
  - [x] 6.1 Create file upload constants (constants/fileUpload.js)
    - Define MAX_FILE_SIZE (10 MB)
    - Define ALLOWED_FORMATS array (.jpg, .jpeg, .png)
    - Define ALLOWED_MIME_TYPES array
    - _Requirements: 6.1, 6.2_
  - [x] 6.2 Create file upload service (services/fileUploadService.js)
    - Implement validateFile() function for format and size validation
    - Implement uploadProfilePicture() function for file storage
    - Add User model update logic for profilePicture field
    - Add error handling for validation failures
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]\* 6.3 Write property test for file validation rules
    - **Property 5: File Validation Rules**
    - **Validates: Requirements 6.1, 6.2**
  - [ ]\* 6.4 Write property test for complete upload process
    - **Property 6: Complete Profile Picture Upload Process**
    - **Validates: Requirements 6.5, 6.6**
  - [ ]\* 6.5 Write unit tests for file upload service
    - Test validation with valid file formats (.jpg, .jpeg, .png)
    - Test validation rejection for invalid formats (.pdf, .exe)
    - Test validation for file size at boundary (exactly 10 MB)
    - Test validation rejection for oversized files
    - Test successful file storage and database update
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 7. Implement controllers and routes
  - [x] 7.1 Create user controller (controllers/userController.js)
    - Implement uploadProfilePicture() controller method
    - Add request parameter extraction (file, userId)
    - Add request validation logic
    - Add service delegation and response formatting
    - Add error passing to error handler
    - _Requirements: 6.5, 6.6, 8.3_
  - [x] 7.2 Create user routes (routes/userRoutes.js)
    - Define POST /api/users/:userId/profile-picture route
    - Configure Multer middleware for multipart/form-data
    - Wire route to controller method
    - _Requirements: 1.3, 8.3_
  - [ ]\* 7.3 Write unit tests for user controller
    - Test successful profile picture upload response
    - Test error handling for missing file
    - Test error handling for invalid userId
    - _Requirements: 6.5, 6.6_

- [x] 8. Implement server monitoring utilities
  - [x] 8.1 Create monitor utility (utils/monitor.js)
    - Implement displayServerStatus() function
    - Add server running status display
    - Add CPU core count display
    - Add CPU usage percentage calculation and display
    - Add timestamp logging
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ]\* 8.2 Write unit tests for monitor utility
    - Test displayServerStatus() output format
    - Test CPU metrics are displayed correctly
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Create main server entry point
  - [x] 9.1 Create server.js file
    - Initialize Express application
    - Load environment variables with dotenv
    - Connect to database using connectDB()
    - Apply security middleware using setupSecurity()
    - Apply body parsing middleware (express.json, express.urlencoded)
    - Register user routes
    - Apply error handler middleware (must be last)
    - Start HTTP server on configured PORT
    - Display server monitoring information
    - _Requirements: 1.1, 1.2, 1.3, 3.4, 8.1, 8.2, 8.3_
  - [ ]\* 9.2 Write integration tests for API endpoints
    - Test POST /api/users/:userId/profile-picture with valid file
    - Test POST /api/users/:userId/profile-picture with invalid file format
    - Test POST /api/users/:userId/profile-picture with oversized file
    - Test rate limiting behavior across multiple requests
    - Test error handler response format
    - _Requirements: 3.3, 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 6.4_

- [x] 10. Final checkpoint - Complete testing and validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with minimum 100 iterations
- Unit tests use Jest framework with supertest for HTTP testing
- Integration tests use mongodb-memory-server for isolated database testing
- All middleware must be applied in correct order (security → routes → error handler)
- File uploads are stored to disk initially (can be extended to cloud storage later)
- The implementation follows Express.js and Node.js best practices throughout
