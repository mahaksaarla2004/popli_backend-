# Popli Backend Deployment Guide

This guide explains how to get the backend up and running locally.

## 1. Start the Database and Cache

The project includes a `docker-compose.yml` file to quickly spin up PostgreSQL and Redis.

```bash
cd popli-backend
docker-compose up -d
```

## 2. Environment Variables

Ensure your `.env` file is configured correctly. A default has been generated:

```env
DATABASE_URL="postgresql://popli_user:popli_password@localhost:5432/popli_db?schema=public"
JWT_SECRET="super-secret-jwt-key"
JWT_REFRESH_SECRET="super-secret-refresh-key"
PORT=3000

CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
```

## 3. Database Migrations

Push the Prisma schema to your newly created PostgreSQL database.

```bash
npx prisma db push
# or to create a migration history:
npx prisma migrate dev --name init
```

## 4. Run the Application

```bash
# Development watch mode
npm run start:dev
```

## 5. Explore the API

Open your browser and navigate to the interactive Swagger documentation:

`http://localhost:3000/api/docs`
