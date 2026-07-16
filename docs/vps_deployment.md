# VPS Deployment Guide

This guide explains how to deploy the AI HR Project (FastAPI backend + Vite/React frontend) to a Linux Virtual Private Server (VPS).

## Prerequisites

Before starting, ensure your VPS has the following installed:
1. **Git**
2. **Docker**
3. **Docker Compose**

*If you are using Ubuntu/Debian, you can install Docker by following the [official Docker installation guide](https://docs.docker.com/engine/install/ubuntu/) and the [Docker Compose guide](https://docs.docker.com/compose/install/linux/).*

## Step 1: Clone the Repository

SSH into your VPS and clone the project repository to your desired directory (e.g., `/opt/ai-hr-project` or your home folder):

```bash
git clone https://github.com/Sujant-h/ai-hr-project.git
cd ai-hr-project
```

## Step 2: Configure Environment Variables

The backend requires certain environment variables (like API keys) to function properly.

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit the `.env` file using a text editor like `nano`:
   ```bash
   nano .env
   ```
3. Update the required keys:
   - `OPENAI_API_KEY`: Add your actual OpenAI API key.
   - `ALLOWED_ORIGINS`: Update this to your production domain name if you have one, or leave it empty if Nginx proxies it locally.

## Step 3: Build and Run with Docker Compose

The project uses Docker Compose to orchestrate two containers:
- `hr_api`: The FastAPI backend.
- `hr_web`: An Nginx container serving the built Vite React app and acting as a reverse proxy for the API.

To build the images and start the containers in the background, run:

```bash
docker-compose up -d --build
```

You can verify that the containers are running correctly using:
```bash
docker-compose ps
```

If you need to view the logs (for troubleshooting):
```bash
docker-compose logs -f
```

## Step 4: Access Your Application

Once the containers are up, the application will be bound to port `80` on your VPS. 

Open your web browser and navigate to your server's public IP address:
```
http://<YOUR_VPS_IP_ADDRESS>
```

---

## Optional (but highly recommended): Setup a Domain with HTTPS

For production, you should access your app via a domain name securely over HTTPS. The easiest way to achieve this is by putting another reverse proxy (like Nginx or Caddy) directly on the host machine.

### Using Nginx and Let's Encrypt (Certbot) on the Host:

1. Install Nginx and Certbot on your host machine:
   ```bash
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx
   ```
2. Create an Nginx server block for your domain (e.g., `ai-hr.yourdomain.com`). Make sure it forwards traffic to port `80` locally (which is mapped to the `hr_web` container).
3. Run Certbot to automatically configure an SSL certificate:
   ```bash
   sudo certbot --nginx -d ai-hr.yourdomain.com
   ```
