# Docker Setup Guide - Pixora Backend

Complete guide to run the Pixora backend using Docker.

## 📋 Prerequisites

- **Docker Desktop** installed ([Download](https://www.docker.com/products/docker-desktop))
- **MongoDB Atlas** account ([Sign up](https://www.mongodb.com/cloud/atlas))

## 🎯 What Docker Provides

✅ **Node.js 20 Alpine** - Lightweight Node.js runtime  
✅ **Redis 7 Alpine** - Caching and rate limiting  
✅ **FFmpeg** - Video processing  
✅ **Hot-reload** - Auto-restart on code changes

**External:** MongoDB Atlas (cloud database)

---

## 🚀 Quick Start (Step-by-Step)

### Step 1: Setup MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user (username + password)
4. Network Access → Add IP Address → Allow Access from Anywhere (`0.0.0.0/0`)
5. Connect → Drivers → Copy connection string

**Example connection string:**

```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/pixora?retryWrites=true&w=majority
```

### Step 2: Configure Environment

```bash
# Copy example environment file
copy .env.example .env
```

Open `.env` and update these values:

```env
# MongoDB Atlas (Required)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/pixora?retryWrites=true&w=majority

# Redis (Already configured for Docker)
REDIS_URL=redis://redis:6379

# AWS S3 (Required)
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Stripe (Required)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# JWT (Required)
JWT_SECRET=your-super-secret-jwt-key-minimum-48-characters-long
```

### Step 3: Start Docker

**Option A - Using Batch Script (Easy):**

```bash
# Just double-click this file:
docker-dev.bat
```

**Option B - Using Command Line:**

```bash
docker-compose up
```

**Option C - Run in Background:**

```bash
docker-compose up -d
```

### Step 4: Verify It's Running

Open your browser:

- **Health Check:** http://localhost:3003/api/health
- **Ready Check:** http://localhost:3003/api/ready

You should see:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🛑 Stop Docker

**Option A - Using Batch Script:**

```bash
# Double-click this file:
docker-down.bat
```

**Option B - Command Line:**

```bash
docker-compose down
```

**Option C - Stop and Remove All Data:**

```bash
docker-compose down -v
```

---

## 📝 Common Commands

### Starting Services

```bash
# Start and see logs
docker-compose up

# Start in background (detached)
docker-compose up -d

# Start and rebuild containers
docker-compose up --build

# Start and force recreate containers
docker-compose up --force-recreate
```

### Stopping Services

```bash
# Stop containers (keeps data)
docker-compose down

# Stop and remove volumes (deletes Redis data)
docker-compose down -v

# Stop and remove everything
docker-compose down -v --remove-orphans
```

### Viewing Logs

```bash
# View all logs
docker-compose logs

# Follow logs (real-time)
docker-compose logs -f

# View app logs only
docker-compose logs -f app

# View Redis logs only
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100
```

### Container Management

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Restart a specific service
docker-compose restart app

# Stop a specific service
docker-compose stop app

# Start a specific service
docker-compose start app
```

### Accessing Containers

```bash
# Access app container shell
docker exec -it pixora-app sh

# Access Redis CLI
docker exec -it pixora-redis redis-cli

# Run command in app container
docker exec -it pixora-app npm run dev

# Check app container environment variables
docker exec -it pixora-app env
```

### Cleanup Commands

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything (BE CAREFUL!)
docker system prune -a --volumes
```

---

## 🔧 Development Workflow

### 1. First Time Setup

```bash
# 1. Copy environment
copy .env.example .env

# 2. Edit .env with your MongoDB Atlas and AWS credentials

# 3. Start Docker
docker-compose up
```

### 2. Daily Development

```bash
# Start Docker
docker-compose up -d

# View logs
docker-compose logs -f app

# Your code changes auto-reload!

# Stop when done
docker-compose down
```

### 3. After Package Changes

```bash
# Rebuild containers
docker-compose up --build

# Or force rebuild
docker-compose build --no-cache
docker-compose up
```

### 4. Clean Restart

```bash
# Stop and remove everything
docker-compose down -v

# Start fresh
docker-compose up --build
```

---

## 📍 Access Points

| Service     | URL                              | Description      |
| ----------- | -------------------------------- | ---------------- |
| **API**     | http://localhost:3003            | Main application |
| **Health**  | http://localhost:3003/api/health | Health check     |
| **Ready**   | http://localhost:3003/api/ready  | Ready check      |
| **Redis**   | localhost:6379                   | Redis cache      |
| **MongoDB** | Your Atlas URI                   | Cloud database   |

---

## 🔍 Troubleshooting

### Problem: Port Already in Use

**Symptom:** Error binding port 3003 or 6379

**Solution:**

```bash
# Check what's using port 3003
netstat -ano | findstr :3003

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
ports:
  - "3004:3000"  # Use 3004 instead
```

### Problem: Cannot Connect to MongoDB Atlas

**Symptoms:**

- "MongoNetworkError"
- "Connection timeout"

**Solutions:**

1. **Check IP Whitelist:**

   ```
   MongoDB Atlas → Network Access → Add IP Address → 0.0.0.0/0
   ```

2. **Verify Connection String:**

   ```env
   # Correct format:
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

   # Check:
   - Username and password correct
   - No special characters (or URL encode them)
   - Database name included
   ```

3. **Test Connection:**
   ```bash
   docker exec -it pixora-app node -e "require('./config/db.js')"
   ```

### Problem: Redis Connection Failed

**Symptom:** "Redis connection refused"

**Solution:**

```bash
# Check if Redis is running
docker-compose ps

# Check Redis logs
docker-compose logs redis

# Test Redis connection
docker exec -it pixora-redis redis-cli ping
# Should return: PONG

# Restart Redis
docker-compose restart redis
```

### Problem: Container Won't Start

**Solution:**

```bash
# View error logs
docker-compose logs app

# Rebuild without cache
docker-compose build --no-cache

# Start fresh
docker-compose down -v
docker-compose up --build
```

### Problem: Changes Not Reflecting

**Symptom:** Code changes don't trigger restart

**Solutions:**

1. **Check volume mount:**

   ```bash
   docker-compose logs app
   # Should see "[nodemon] restarting due to changes..."
   ```

2. **Restart container:**

   ```bash
   docker-compose restart app
   ```

3. **Rebuild:**
   ```bash
   docker-compose up --build
   ```

### Problem: Out of Disk Space

**Solution:**

```bash
# Check disk usage
docker system df

# Clean up
docker system prune -a --volumes

# Remove specific items
docker volume prune
docker image prune -a
```

### Problem: node_modules Issues

**Symptom:** Missing dependencies or package errors

**Solution:**

```bash
# Rebuild with fresh node_modules
docker-compose down
docker-compose build --no-cache
docker-compose up
```

---

## 📊 Health Checks

### Redis Health Check

```bash
# Manual check
docker exec -it pixora-redis redis-cli ping

# Should return: PONG
```

### App Health Check

```bash
# Using curl
curl http://localhost:3003/api/health

# Using browser
http://localhost:3003/api/health
```

---

## 🔐 Security Notes

1. **Never commit `.env`** - Contains sensitive credentials
2. **Whitelist specific IPs in production** - Not 0.0.0.0/0
3. **Use strong JWT secret** - Minimum 48 characters
4. **Rotate credentials regularly** - AWS, Stripe, MongoDB
5. **Use environment-specific configs** - Different .env for dev/prod

---

## 📦 What's Inside the Container?

```
/pixora-app/           # Working directory
├── node_modules/      # Dependencies
├── config/            # Configuration files
├── controllers/       # Route controllers
├── models/            # Database models
├── routes/            # API routes
├── services/          # Business logic
├── middlewares/       # Express middlewares
├── utils/             # Utility functions
├── temp/              # Temporary file uploads
└── app.js             # Main application file
```

---

## 🌐 Environment Variables Reference

| Variable    | Docker Value         | Local Value              | Description                 |
| ----------- | -------------------- | ------------------------ | --------------------------- |
| `PORT`      | `3000`               | `3000`                   | App port (inside container) |
| `NODE_ENV`  | `development`        | `development`            | Environment mode            |
| `MONGO_URI` | MongoDB Atlas URI    | MongoDB Atlas URI        | Database connection         |
| `REDIS_URL` | `redis://redis:6379` | `redis://localhost:6379` | Redis connection            |

**Note:** In Docker, use service name `redis` instead of `localhost`.

---

## 🎯 Best Practices

1. ✅ **Use `.env` for configuration** - Never hardcode credentials
2. ✅ **Run in detached mode** - `docker-compose up -d` for daily work
3. ✅ **Monitor logs** - `docker-compose logs -f` to catch errors
4. ✅ **Clean up regularly** - `docker system prune` to free space
5. ✅ **Rebuild after updates** - `--build` after package changes
6. ✅ **Use hot-reload** - Code changes auto-restart the server
7. ✅ **Test before committing** - Ensure Docker setup works

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Redis Documentation](https://redis.io/documentation)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 💡 Pro Tips

1. **Alias Commands:**

   ```bash
   # Add to your shell profile
   alias dcu="docker-compose up"
   alias dcd="docker-compose down"
   alias dcl="docker-compose logs -f"
   ```

2. **Quick Logs:**

   ```bash
   # Watch app logs only
   docker-compose logs -f app | grep -v "GET /api/health"
   ```

3. **Database Connection:**

   ```bash
   # Test MongoDB connection
   docker exec -it pixora-app node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(() => console.log('Connected')).catch(e => console.error(e))"
   ```

4. **Redis Monitoring:**
   ```bash
   # Monitor Redis commands
   docker exec -it pixora-redis redis-cli MONITOR
   ```

---

## 🆘 Getting Help

If you encounter issues:

1. **Check logs:** `docker-compose logs -f`
2. **Verify .env:** Ensure all required variables are set
3. **Clean restart:** `docker-compose down -v && docker-compose up --build`
4. **Check documentation:** Review this file and Docker docs
5. **Search errors:** Google the specific error message

---

**Happy Coding! 🚀**
