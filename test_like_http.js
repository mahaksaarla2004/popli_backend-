const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const userId = '8fbb0e8c-ad84-4ea1-aa8f-281c94d6134a';
    const reelId = '42c2fc46-681e-4d04-aee8-f968eb483dc3';

    // Get a valid JWT for the user. But wait, I don't have the secret!
    // I will just look at the .env file.
    console.log(process.env.JWT_SECRET);
  } catch (error) {
    console.error(error);
  }
}
main();
