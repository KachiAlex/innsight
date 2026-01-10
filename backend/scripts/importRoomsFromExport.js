const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EXPORT_PATH = path.resolve(__dirname, '../rooms-export/firestore-export/all_namespaces/kind_rooms/output-0');

const parseValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return Boolean(value.booleanValue);
    if ('timestampValue' in value) return new Date(value.timestampValue);
    if ('mapValue' in value) {
      const mapFields = value.mapValue.fields || {};
      const obj = {};
      Object.entries(mapFields).forEach(([key, val]) => {
        obj[key] = parseValue(val);
      });
      return obj;
    }
    if ('arrayValue' in value) {
      const arr = value.arrayValue.values || [];
      return arr.map(parseValue);
    }
    if ('nullValue' in value) return null;
  }
  return value;
};

async function main() {
  if (!fs.existsSync(EXPORT_PATH)) {
    console.error('Export file not found:', EXPORT_PATH);
    process.exit(1);
  }

  const buffers = [];
  const stream = fs.createReadStream(EXPORT_PATH);
  for await (const chunk of stream) {
    buffers.push(chunk);
  }
  const file = Buffer.concat(buffers);
  const lines = file.toString('utf8').split('\n').filter(Boolean);

  console.log(`Processing ${lines.length} records`);

  for (const line of lines) {
    const entry = JSON.parse(line);
    if (!entry.document) continue;
    const doc = entry.document;
    const fields = doc.fields || {};

    if (fields.tenantId?.stringValue !== 'O9W98cPvgSQiNmfyfkKk') {
      continue;
    }

    const payload = {
      tenantId: fields.tenantId.stringValue,
      roomNumber: parseValue(fields.roomNumber)?.toString() || '',
      roomType: parseValue(fields.roomType)?.toString() || 'standard',
      floor: parseValue(fields.floor),
      status: parseValue(fields.status)?.toString() || 'available',
      maxOccupancy: parseValue(fields.maxOccupancy) || 1,
      amenities: parseValue(fields.amenities) || null,
      ratePlanId: parseValue(fields.ratePlanId) || null,
      categoryId: parseValue(fields.categoryId) || null,
      description: parseValue(fields.description) || null,
      customRate: parseValue(fields.customRate),
      lastLogType: parseValue(fields.lastLogType) || null,
      lastLogSummary: parseValue(fields.lastLogSummary) || null,
      lastLogUserName: parseValue(fields.lastLogUserName) || null,
      lastLogAt: parseValue(fields.lastLogAt),
      createdAt: parseValue(fields.createdAt) || new Date(),
      updatedAt: parseValue(fields.updatedAt) || new Date(),
    };

    const id = doc.name.split('/').pop();

    await prisma.room.upsert({
      where: { id },
      update: payload,
      create: {
        id,
        ...payload,
      },
    });
  }

  console.log('Import complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
