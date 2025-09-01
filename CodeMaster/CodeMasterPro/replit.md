# Overview

CodeMaster Pro is a code analysis and development hub built as a full-stack web application. The project provides an integrated development environment with modular external tools for code analysis, editing, and optimization. The core application features a React frontend with specialized workshops (CSS Editor, Prefetch/Preconnect Inspector) that operate through an overlay system, allowing users to analyze and modify code files with real-time feedback and collaborative tool communication.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development/build tooling
- **UI System**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: React hooks with custom overlay and workshop message management systems
- **Routing**: wouter for lightweight client-side routing
- **Data Fetching**: TanStack Query for server state management with custom query functions

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints for project and analysis management
- **Storage Layer**: Pluggable storage interface with in-memory implementation (designed for future database integration)
- **Development**: Vite integration for hot module replacement and development middleware

## Workshop System
- **Communication**: PostMessage API for secure iframe-based tool communication
- **Tool Architecture**: Modular workshops (CSS Editor, Prefetch Inspector) that run in isolated overlays
- **Message Protocol**: Structured message types for tool coordination (WORKSHOP_READY, WORKSHOP_APPLY_PATCH, etc.)
- **Code Processing**: Real-time code analysis with syntax highlighting and diff visualization

## Data Storage Solutions
- **Database ORM**: Drizzle ORM configured for PostgreSQL with schema migrations
- **Schema Design**: Normalized tables for users, projects, and analysis results with JSONB for flexible file storage
- **Development Storage**: Memory-based storage implementation for local development
- **Session Management**: PostgreSQL session store with connect-pg-simple

## Authentication & Authorization
- **Session-based**: Express sessions with PostgreSQL backing store
- **User Management**: Username/password authentication with project ownership model
- **API Security**: Credential-based requests with proper error handling for unauthorized access

# External Dependencies

## Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection for serverless environments
- **drizzle-orm & drizzle-kit**: Type-safe database ORM and migration toolkit
- **express**: Web application framework for API endpoints
- **vite**: Build tool and development server with React plugin support

## Frontend UI/UX Libraries
- **@radix-ui/react-***: Comprehensive set of accessible UI primitives (dialogs, dropdowns, forms, etc.)
- **@tanstack/react-query**: Server state management and caching
- **tailwindcss**: Utility-first CSS framework for component styling
- **lucide-react**: Icon library for UI elements

## Development & Build Tools
- **typescript**: Static type checking for both frontend and backend
- **@replit/vite-plugin-***: Replit-specific development plugins for error overlay and cartographer integration
- **esbuild**: Fast JavaScript bundler for production builds

## Code Analysis Tools
- **wouter**: Lightweight routing library for single-page application navigation
- **class-variance-authority**: Utility for managing conditional CSS classes in components
- **date-fns**: Date manipulation library for timestamps and formatting