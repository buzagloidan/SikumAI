/**
 * Supabase Hosting Configuration
 * This file contains settings for deploying your app to Supabase hosting
 */

module.exports = {
  // The project ID from your Supabase project
  projectId: process.env.SUPABASE_PROJECT_ID || "your-supabase-project-id",
  
  // The directory containing the web build
  buildDir: "web-build",
  
  // Custom domain settings (optional)
  // customDomain: "app.yourdomain.com",
  
  // Cache control headers
  cacheControl: {
    // Cache static assets for 1 year
    "/**/*.{js,css,png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot}": "public, max-age=31536000, immutable",
    // Don't cache HTML files
    "/**/*.html": "public, max-age=0, must-revalidate",
    // Don't cache the service worker
    "/service-worker.js": "public, max-age=0, must-revalidate"
  },
  
  // Error page settings
  errorPages: {
    404: "/404.html"
  }
}; 