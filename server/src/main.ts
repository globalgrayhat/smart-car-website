// src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IoAdapter } from "@nestjs/platform-socket.io";

async function bootstrap() {
  // create app
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // CORS for REST + WS
  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:56211",
    "http://127.0.0.1:56211",
  ];

  app.enableCors({
    origin: (origin, cb) => {
      // allow same-origin / tools / curl
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type, Authorization, x-internal-key",
  });

  // VERY IMPORTANT: enable mediasoup on the same port (3000)
  // frontend is connecting to http://localhost:3000/mediasoup
  app.useWebSocketAdapter(new IoAdapter(app));

  // prefix /api for REST
  app.setGlobalPrefix("api");

  // global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = config.get<number>("PORT", 3000);
  await app.listen(port, "0.0.0.0");

  // eslint-disable-next-line no-console
  console.log(`🚀 API on http://localhost:${port}/api`);
  console.log(`🟢 mediasoup on http://localhost:${port}/mediasoup`);
}
bootstrap();
