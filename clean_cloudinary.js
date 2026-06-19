const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dekt0pjij',
  api_key: '277917496774264',
  api_secret: 'ekp_Umr7qld9fLwDdKqku033mb0',
});

async function deleteAll() {
  try {
    console.log('Fetching image resources...');
    let result = await cloudinary.api.resources({ type: 'upload', max_results: 500, resource_type: 'image' });
    let images = result.resources.map(r => r.public_id);
    
    if (images.length > 0) {
      console.log(`Deleting ${images.length} images...`);
      await cloudinary.api.delete_resources(images, { resource_type: 'image' });
    } else {
      console.log('No images found.');
    }

    console.log('Fetching video resources...');
    result = await cloudinary.api.resources({ type: 'upload', max_results: 500, resource_type: 'video' });
    let videos = result.resources.map(r => r.public_id);
    
    if (videos.length > 0) {
      console.log(`Deleting ${videos.length} videos...`);
      await cloudinary.api.delete_resources(videos, { resource_type: 'video' });
    } else {
      console.log('No videos found.');
    }

    console.log('Cleanup completed successfully.');
  } catch (error) {
    console.error('Error cleaning Cloudinary:', error);
  }
}

deleteAll();
