// Simple test function for Vercel
module.exports = (req, res) => {
  res.status(200).json({
    message: 'Test API function is working!',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })
}