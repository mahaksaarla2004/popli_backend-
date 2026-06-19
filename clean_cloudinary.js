const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dekt0pjij',
  api_key: '277917496774264',
  api_secret: 'ekp_Umr7qld9fLwDdKqku033mb0',
});

async function deleteAll() {
  try {
    console.log('Deleting all image resources...');
    await cloudinary.api.delete_all_resources({ resource_type: 'image' });

    console.log('Deleting all video resources...');
    await cloudinary.api.delete_all_resources({ resource_type: 'video' });

    console.log('Cleanup completed successfully.');
  } catch (error) {
    console.error('Error cleaning Cloudinary:', error);
  }
}

deleteAll();
