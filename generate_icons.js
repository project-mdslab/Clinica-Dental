const sharp = require('sharp');
const fs = require('fs');

async function createIcons() {
  const input = 'public/images/logo_b.png';
  
  // Create 192x192
  await sharp(input)
    .resize(192, 192, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 } // transparent background
    })
    .toFile('public/icon-192x192.png');
    
  console.log('Created icon-192x192.png');
  
  // Create 512x512
  await sharp(input)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toFile('public/icon-512x512.png');
    
  console.log('Created icon-512x512.png');
}

createIcons().catch(console.error);
