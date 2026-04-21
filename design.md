# Design Document: Node.js Application Structure

## Overview

This design document describes a Node.js application with a layered architecture pattern that provides user management, file upload capabilities, security features, and server monitoring. The application follows Express.js best practices with clear separation of concerns across controllers, routes, services, middlewares, and configuration layers.

The system is designed to be minimal yet complete, implementing only essential functionality while maintaining extensibility for future enhancements. The architecture emphasizes maintainability through organized directory structure and clear component boundaries.

### Key Design Goals

- Layered architecture with separation of concerns
- Secure by default with industry-standard middleware
- Robust error handling and logging
- MongoDB integration for data persistence
- File upload handling with validation
- Server health monitoring

## Architecture

### High-Level Architecture

The application follows a three-tier architecture pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP Requests                        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Middleware Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  CORS    │  │  Helmet  │  │  Rate Limiter        │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Routing Layer                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Routes (URL mapping to controllers)             │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Controller Layer                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Request validation & response formatting        │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Service Layer                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Business logic & file processing                │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Data Layer                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │  MongoDB Models & Database Operations            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Request Entry**: HTTP requests enter through Express middleware stack
2. **Security Processing**: CORS, Helmet, and rate limiting middleware process requests
3. **Routing**: Routes map URLs to appropriate controller methods
4. **Controller Processing**: Controllers validate input and delegate to services
5. **Business Logic**: Services execute business logic and interact with models
6. **Data Access**: Models handle MongoDB operations
7. **Response**: Results flow back through the stack to the client
8. **Error Handling**: Global error handler catches and formats all errors

### Directory Structure

```
project-root/
├── config/
│   └── db.js                 # Database connection configuration
├── constants/
│   └── fileUpload.js         # File upload constants (size, formats)
├── controllers/
│   └── userController.js     # User-related request handlers
├── middlewares/
│   ├── errorHandler.js       # Global error handling middleware
│   └── security.js           # Security middleware configuration
├── models/
│   └── User.js               # User MongoDB schema
├── routes/
│   └── userRoutes.js         # User route definitions
├── services/
│   └── fileUploadService.js  # File upload business logic
├── utils/
│   └── monitor.js            # Server monitoring utilities
├── .env                      # Environment variables
├── .gitignore                # Git ignore patterns
├── package.json              # Dependencies and scripts
└── server.js                 # Application entry point
```

## Components and Interfaces

### 1. Server Entry Point (server.js)

**Responsibility**: Application initialization and server startup

**Interface**:
- Initializes Express application
- Loads environment configuration
- Connects to database
- Registers middleware
- Registers routes
- Starts HTTP server
- Displays server monitoring information

**Dependencies**:
- Express framework
- dotenv for configuration
- Database connection module
- Security middleware
- Error handler middleware
- Route modules
- Monitor utility

### 2. Configuration Layer

#### 2.1 Database Configuration (config/db.js)

**Responsibility**: MongoDB connection management

**Interface**:
```javascript
connectDB(): Promise<void>
```

**Behavior**:
- Reads MongoDB URI from environment variables
- Establishes connection to MongoDB
- Logs success message on connection
- Logs error and exits process on failure

**Environment Variables**:
- `MONGO_URI`: MongoDB connection string

#### 2.2 Environment Configuration (.env)

**Responsibility**: Store configuration values

**Required Variables**:
- `PORT`: Server port number
- `MONGO_URI`: MongoDB connection string
- `NODE_ENV`: Environment (development/production)

### 3. Security Middleware (middlewares/security.js)

**Responsibility**: Apply security protections to all requests

**Interface**:
```javascript
setupSecurity(app: Express): void
```

**Components**:
- **CORS**: Enables cross-origin resource sharing
- **Helmet**: Sets secure HTTP headers
- **Rate Limiter**: Prevents abuse through request throttling

**Configuration**:
- Rate limit: Configurable window and max requests per window
- CORS: Allow all origins (configurable for production)
- Helmet: Default secure headers

### 4. Error Handler Middleware (middlewares/errorHandler.js)

**Responsibility**: Centralized error handling for all routes

**Interface**:
```javascript
errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void
```

**Behavior**:
- Catches all errors from route handlers
- Determines appropriate HTTP status code
- Formats error response as JSON
- Logs error details to console
- Returns consistent error structure to client

**Error Response Format**:
```javascript
{
  success: false,
  message: string,
  error: string (in development only)
}
```

### 5. User Model (models/User.js)

**Responsibility**: Define user data structure and validation

**Schema Fields**:
- `name`: String, required
- `email`: String, required, unique
- `profilePicture`: String, optional (file path or URL)
- `createdAt`: Date, auto-generated
- `updatedAt`: Date, auto-generated

**Interface**:
```javascript
User.create(userData: Object): Promise<UserDocument>
User.findById(id: string): Promise<UserDocument>
User.findByIdAndUpdate(id: string, update: Object): Promise<UserDocument>
```

### 6. File Upload Service (services/fileUploadService.js)

**Responsibility**: Handle file upload business logic and validation

**Interface**:
```javascript
uploadProfilePicture(file: File, userId: string): Promise<{ success: boolean, filePath: string }>
validateFile(file: File): { valid: boolean, error?: string }
```

**Validation Rules**:
- Allowed formats: .jpg, .jpeg, .png
- Maximum size: 10 MB
- File must be present

**Behavior**:
- Validates file format and size
- Stores file to disk or cloud storage
- Updates user model with file reference
- Returns file path or URL

**Dependencies**:
- File upload constants
- User model
- File system or cloud storage SDK

### 7. File Upload Constants (constants/fileUpload.js)

**Responsibility**: Define file upload constraints

**Exports**:
```javascript
{
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB in bytes
  ALLOWED_FORMATS: ['.jpg', '.jpeg', '.png'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png']
}
```

### 8. User Controller (controllers/userController.js)

**Responsibility**: Handle HTTP requests for user operations

**Interface**:
```javascript
uploadProfilePicture(req: Request, res: Response, next: NextFunction): Promise<void>
```

**Behavior**:
- Extracts file and userId from request
- Validates request parameters
- Delegates to file upload service
- Formats success response
- Passes errors to error handler

**Response Format**:
```javascript
{
  success: true,
  message: string,
  data: {
    filePath: string
  }
}
```

### 9. User Routes (routes/userRoutes.js)

**Responsibility**: Map URLs to controller methods

**Routes**:
- `POST /api/users/:userId/profile-picture`: Upload profile picture

**Middleware Chain**:
1. Multer middleware for multipart/form-data parsing
2. Controller method
3. Error handler (implicit)

### 10. Server Monitor (utils/monitor.js)

**Responsibility**: Display server status and system metrics

**Interface**:
```javascript
displayServerStatus(port: number): void
```

**Displayed Information**:
- Server running status
- Port number
- Number of CPU cores
- Current CPU usage percentage
- Timestamp

## Data Models

### User Model Schema

```javascript
{
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  profilePicture: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}
```

**Indexes**:
- `email`: Unique index for fast lookup and uniqueness constraint

**Validation**:
- `name`: Required, non-empty string
- `email`: Required, unique, valid email format
- `profilePicture`: Optional string (file path or URL)

**Timestamps**:
- Mongoose timestamps option enabled for automatic createdAt/updatedAt management

### File Upload Data Flow

```
Client Request (multipart/form-data)
    │
    ▼
Multer Middleware (parses file)
    │
    ▼
Controller (extracts file & userId)
    │
    ▼
File Upload Service
    │
    ├─► Validate format (.jpg, .jpeg, .png)
    │
    ├─► Validate size (≤ 10 MB)
    │
    ├─► Store file (disk/cloud)
    │
    └─► Update User Model
            │
            ▼
        Database (MongoDB)
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Configuration Loading

For any valid .env file containing required configuration keys (PORT, MONGO_URI, NODE_ENV), the Configuration_Loader should successfully load all values and make them accessible through process.env.

**Validates: Requirements 1.2**

### Property 2: Database Connection with Valid Configuration

For any valid MongoDB connection string provided in environment variables, the Database_Connection should successfully establish a connection to the database without throwing errors.

**Validates: Requirements 2.1**

### Property 3: Rate Limiting Enforcement

For any client making requests to the server, after exceeding the configured rate limit threshold within the time window, all subsequent requests should receive a 429 (Too Many Requests) status code until the window resets.

**Validates: Requirements 3.3**

### Property 4: Comprehensive Error Handling

For any error thrown in a route handler, the Error_Handler should catch the error, return a JSON response with the appropriate HTTP status code and error details, and log the error information to the console.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 5: File Validation Rules

For any uploaded file, the File_Validator should accept it if and only if the file has an extension of .jpg, .jpeg, or .png AND the file size is less than or equal to 10 MB. All other files should be rejected with an appropriate error message.

**Validates: Requirements 6.1, 6.2**

### Property 6: Complete Profile Picture Upload Process

For any valid file (correct format and size) uploaded for a user, the User_Profile_Upload_Service should store the file and update the corresponding user's profilePicture field in the database with the file path or URL.

**Validates: Requirements 6.5, 6.6**

### Property 7: User Model Required Field Validation

For any user object missing required fields (name or email), attempting to save it to the database should fail with a validation error, and no document should be created in the database.

**Validates: Requirements 7.4**

## Error Handling

### Error Handling Strategy

The application implements a centralized error handling approach using Express error-handling middleware. All errors flow through a single error handler that provides consistent error responses and logging.

### Error Types and Status Codes

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| Validation Error | 400 | Invalid input data or file validation failure |
| Not Found | 404 | Resource not found |
| Rate Limit Exceeded | 429 | Too many requests from client |
| Server Error | 500 | Unexpected server errors |

### Error Response Format

All errors return a consistent JSON structure:

```javascript
{
  success: false,
  message: "Human-readable error message",
  error: "Detailed error information (development only)"
}
```

### Error Handling Flow

```
Route Handler Error
    │
    ▼
next(error) called
    │
    ▼
Error Handler Middleware
    │
    ├─► Determine status code
    │
    ├─► Format error response
    │
    ├─► Log error details
    │
    └─► Send JSON response to client
```

### File Upload Error Handling

File upload errors are handled at multiple levels:

1. **Multer Level**: Catches file parsing errors (missing file, wrong field name)
2. **Validation Level**: Validates file format and size before processing
3. **Service Level**: Handles file storage and database update errors
4. **Global Level**: Error handler catches any unhandled errors

### Database Error Handling

Database errors are caught and handled appropriately:

- **Connection Errors**: Log error and terminate application (fail-fast approach)
- **Validation Errors**: Return 400 status with validation details
- **Duplicate Key Errors**: Return 400 status indicating duplicate email
- **Query Errors**: Return 500 status with generic error message

### Logging Strategy

- **Development**: Log full error stack traces and details
- **Production**: Log sanitized error messages without sensitive information
- **Error Logs**: Include timestamp, error type, message, and stack trace
- **Success Logs**: Include operation type and relevant identifiers

## Testing Strategy

### Dual Testing Approach

The application will be tested using both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property-Based Tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs and verify specific behaviors, while property-based tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Library**: fast-check (JavaScript/TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with reference to design document property
- Tag format: `Feature: nodejs-app-structure, Property {number}: {property_text}`

**Property Test Implementation**:

Each correctness property defined in this document must be implemented as a single property-based test:

1. **Property 1 (Configuration Loading)**: Generate random valid .env content, verify all values are loaded
2. **Property 2 (Database Connection)**: Generate valid MongoDB URIs, verify connection succeeds
3. **Property 3 (Rate Limiting)**: Generate random request counts, verify rate limiting after threshold
4. **Property 4 (Error Handling)**: Generate random errors, verify consistent handling
5. **Property 5 (File Validation)**: Generate files with random formats/sizes, verify validation rules
6. **Property 6 (Upload Process)**: Generate valid files, verify storage and database update
7. **Property 7 (Model Validation)**: Generate user objects with missing fields, verify validation failure

### Unit Testing Strategy

Unit tests will focus on:

1. **Specific Examples**:
   - Successful profile picture upload with valid .jpg file
   - Successful database connection with valid URI
   - Server monitoring displays correct information

2. **Edge Cases**:
   - Empty .env file
   - File exactly at 10 MB size limit
   - User with minimal required fields only

3. **Error Conditions**:
   - Invalid file format upload (.pdf, .exe)
   - File exceeding size limit
   - Database connection with invalid URI
   - Missing required user fields
   - Duplicate email registration

4. **Integration Points**:
   - Middleware stack order verification
   - Route to controller to service flow
   - Database model to service integration

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 80% code coverage
- **Property Test Coverage**: All 7 correctness properties implemented
- **Integration Test Coverage**: All API endpoints tested
- **Error Path Coverage**: All error handlers tested

### Testing Tools

- **Test Framework**: Jest
- **Property-Based Testing**: fast-check
- **HTTP Testing**: supertest
- **Database Testing**: mongodb-memory-server (in-memory MongoDB for tests)
- **Mocking**: Jest built-in mocking capabilities

### Test Organization

```
tests/
├── unit/
│   ├── controllers/
│   │   └── userController.test.js
│   ├── services/
│   │   └── fileUploadService.test.js
│   ├── middlewares/
│   │   ├── errorHandler.test.js
│   │   └── security.test.js
│   └── models/
│       └── User.test.js
├── property/
│   ├── configuration.property.test.js
│   ├── database.property.test.js
│   ├── rateLimiting.property.test.js
│   ├── errorHandling.property.test.js
│   ├── fileValidation.property.test.js
│   ├── uploadProcess.property.test.js
│   └── modelValidation.property.test.js
└── integration/
    └── api.integration.test.js
```

### Continuous Integration

- Run all tests on every commit
- Fail build if any test fails
- Generate coverage reports
- Run property tests with increased iterations (1000+) in CI environment

