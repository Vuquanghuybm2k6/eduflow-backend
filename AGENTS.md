
# EduFlow Backend - AI Development Guidelines

## Project Overview

EduFlow is a multi-tenant SaaS platform for education management.

The backend is built with:

- NestJS
- PostgreSQL
- Prisma
- Redis
- JWT
- Jest
- Docker

## Architecture

Use a modular monolith architecture.

Each business domain should be implemented as a NestJS module.

Example:

src/
├── auth/
├── users/
├── organizations/
├── memberships/
├── students/
├── teachers/
├── classes/
├── subjects/
├── attendance/
├── grades/
├── schedules/
├── notifications/
└── subscriptions/

## Architecture Rules

- Controllers handle HTTP requests only.
- Business logic belongs in services.
- Database access must go through Prisma.
- Do not put business logic inside controllers.
- Do not access Prisma directly from controllers.
- Use DTOs for request validation.
- Use class-validator for validation.
- Use guards for authentication and authorization.
- Use decorators for extracting authenticated user information.

## Multi-tenancy

EduFlow is a multi-tenant application.

Every organization has isolated data.

Most organization-owned entities must contain:

organizationId

Never trust organizationId directly from the client.

The organizationId must be obtained from the authenticated user's membership/context.

Every database query involving tenant-owned data must enforce organization isolation.

Example:

Correct:

prisma.student.findMany({
  where: {
    organizationId: currentOrganizationId
  }
})

Incorrect:

prisma.student.findMany()

## Authorization

Use RBAC with permissions.

Example permissions:

student:create
student:read
student:update
student:delete

Do not implement authorization using scattered role checks such as:

if (user.role === "admin")

Prefer centralized guards/decorators.

## Database

Use PostgreSQL with Prisma.

Follow these rules:

- Use UUIDs for primary keys.
- Use foreign keys.
- Add indexes for frequently queried fields.
- Add unique constraints where required.
- Use timestamps.
- Use soft delete only where business requirements require it.

## API

Use RESTful APIs.

Example:

GET    /students
GET    /students/:id
POST   /students
PATCH  /students/:id
DELETE /students/:id

Use appropriate HTTP status codes.

## Error Handling

Use NestJS exception classes.

Do not expose internal database errors to clients.

Return meaningful error messages.

## Testing

Business-critical services must have unit tests.

Important areas:

- Authentication
- Authorization
- Multi-tenancy
- Student management
- Attendance
- Grade management
- Subscription limits

## Security

Never:

- commit secrets
- expose JWT secrets
- trust organizationId from request body
- return password hashes
- disable authentication guards to make development easier

Use environment variables for secrets.

## Code Style

Prefer:

- clear naming
- small functions
- explicit types
- reusable services
- dependency injection

Avoid unnecessary abstraction.

Do not introduce microservices unless explicitly required.

## AI Instructions

Before modifying code:

1. Understand the existing module structure.
2. Check related DTOs, services, controllers and Prisma schema.
3. Reuse existing patterns.
4. Do not create duplicate utilities.
5. Do not change unrelated files.
6. Explain important architectural changes.

When implementing a feature:

1. Check database requirements.
2. Check authorization requirements.
3. Implement DTO.
4. Implement service logic.
5. Implement controller.
6. Add tests.
7. Update documentation if necessary.
