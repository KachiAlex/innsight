const fs = require('fs');
const path = require('path');

const backendSchemaPath = path.resolve(__dirname, '../../../backend/prisma/schema.prisma');
const prismaDir = path.resolve(__dirname, '../prisma');
const targetSchemaPath = path.join(prismaDir, 'schema.prisma');

if (!fs.existsSync(backendSchemaPath)) {
  console.error('[prepare-prisma-schema] Backend schema not found:', backendSchemaPath);
  process.exit(1);
}

fs.mkdirSync(prismaDir, { recursive: true });
fs.copyFileSync(backendSchemaPath, targetSchemaPath);
console.log('[prepare-prisma-schema] Copied Prisma schema to frontend/api/prisma directory.');
