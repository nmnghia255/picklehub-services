# PickleHub Services

This repository contains the microservices for the PickleHub platform.

## ✅ Prerequisites

Before you begin, ensure you have **Docker Desktop** (or an equivalent Docker runtime) installed and **running**.
*   [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)

## 🚀 Quick Start (Frontend Developers)

1.  **Environment Setup**
    *   Copy `.env.example` to `.env` in the root directory.
    *   Update the `.env` file with any necessary secrets (e.g., `RESEND_API_KEY`).
    *   **Note**: usage of individual service configuration files (e.g., `.env`) or manual dependency installation (e.g., `npm install` inside service folders) is **not required**. The Docker setup manages all dependencies and environment variables centrally.

2.  **Run the App**
    *   Start all services and databases:
        ```bash
        npm run start
        ```
    *   **Note**: Use `npm run dev` if you are actively modifying backend code and need hot-reloading (watch mode). `npm run start` runs services in the background.
    *   **Update**: When pulling new code from the repository, use `npm run restart` to ensure all containers are recreated with the latest changes.

3.  **Database Migration**
    *   After the services are up and running, open a **new terminal** and run:
        ```bash
        npm run db:migrate
        ```
    *   This applies database changes to all services.

4.  **Start Developing**
    *   You are now ready to go!
    *   Test the APIs using Postman or your preferred API client.

## 🛠️ Commands

| Command | Description |
| :--- | :--- |
| `npm run start` | Starts all services in the background (Detached mode). Best for frontend dev. |
| `npm run dev` | Starts all services and databases in Docker (Watch mode). Best for backend dev. |
| `npm run db:migrate` | Runs Prisma migrations for **all** services. |
| `npm run db:reset` | **Resets** all databases (erases data) and re-runs migrations. |
| `npm run stop` | Stops all running containers. |
| `npm run restart` | Stops and then starts all services (Hard restart). |
| `npm run clean` | Stops containers and removes volumes (fresh start). |

## 📦 Services

| Service | Local Port | Docker Service Name |
| :--- | :--- | :--- |
| **API Gateway** | `8080` | `api-gateway` |
| **Auth Service** | `8001` | `auth-service` |
| **Notification Service** | `8002` | `notification-service` |
| **Group Service** | `8003` | `group-service` |
| **Event Service** | `8004` | `event-service` |
| **Match Service** | `8005` | `match-service` |
| **User Service** | `8006` | `user-service` |
| **Sport Center Service** | `8007` | `sport-center-service` |
| **Tournament Service** | `8008` | `tournament-service` |
| **Friend Service** | `8010` | `friend-service` |
| **Media Service** | `8011` | `media-service` |
| **Subscription Service** | `8012` | `subscription-service` |
| **Coach Service** | `8019` | `coach-service` |
| **Chat Service** | `8029` | `chat-service` |
| **Redis** | `6379` | `redis` |
| **Auth DB** | `5432` | `postgres-auth` |
| **Notification DB** | `5433` | `postgres-notification` |
| **Group DB** | `5434` | `postgres-group` |
| **Event DB** | `5435` | `postgres-event` |
| **Match DB** | `5436` | `postgres-match` |
| **User DB** | `5437` | `postgres-user` |
| **Sport Center DB** | `5438` | `postgres-sport-center` |
| **Tournament DB** | `5439` | `postgres-tournament` |
| **Friend DB** | `5441` | `postgres-friend` |
| **Subscription DB** | `5442` | `postgres-subscription` |
| **Coach DB** | `5453` | `postgres-coach` |
| **Chat DB** | `5463` | `postgres-chat` |

## 💻 Backend Development Guide

> **⚠️ IMPORTANT**: Before submitting a Pull Request, verify that your changes work seamlessly with the root-level Docker setup. You should be able to run `npm run dev` (or `start`) from the root **without** requiring `.env` files or `node_modules`, `dist` inside the individual service directories. This ensures the project remains easy to run for everyone.

### Option 1: Development with Docker (Recommended)
This is the easiest way to ensure your environment matches production.

1.  **Start in Watch Mode**:
    ```bash
    npm run dev
    ```
    *   This runs all services in "watch mode".
    *   Included services: `auth-service`, `notification-service`, `group-service`, `event-service`, `match-service`, `user-service`, `sport-center-service`, `tournament-service`, `friend-service`, `media-service`, `subscription-service`, `coach-service`, `chat-service`, and `api-gateway`.
    *   Changes to files in `src/` are detected and the service automatically recompiles/restarts within the container.
    *   **Windows Users**: Polling is enabled by default to ensure file changes are detected across the filesystem boundary.

2.  **Viewing Logs**:
    *   Logs stream to your terminal. Press `Ctrl+C` to stop.
    *   **Docker Desktop**: You can also just click on the container in the Docker Desktop dashboard to view logs.
    *   To view logs for a specific service while running in background (`npm run start`):
        ```bash
        docker compose logs -f service-name
        ```

### Option 2: Running Services Locally (Outside Docker)
Useful for debugging, running tests, or if you prefer a native setup.

1.  **Start Databases Only**:
    You need a running database. You can start the project's databases via Docker:
    ```bash
    docker compose up -d postgres-auth postgres-notification postgres-group postgres-event postgres-match postgres-user postgres-sport-center postgres-tournament postgres-friend postgres-subscription postgres-coach postgres-chat
    ```
    *   *Alternatively, you can use your own local PostgreSQL instance, Supabase, pgAdmin, or any other preference. Just ensure you update the `DATABASE_URL` in your service's `.env` file to point to it.*

2.  **Setup Individual Service**:
    Navigate to the service directory and follow these steps:

    *   **Install Dependencies**:
        ```bash
        npm install
        ```
    *   **Configure Environment**:
        *   Copy `.env.example` to `.env`.
        *   Adjust `DATABASE_URL` and other environment variables if needed.
    *   **Generate Prisma Client**:
        ```bash
        npx prisma generate
        ```
    *   **Run the Service**:
        ```bash
        npm run start:dev
        ```
    *   You are now ready to go!
