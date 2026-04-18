module.exports = async (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Hello from Vercel serverless function!',
    timestamp: new Date().toISOString()
  });
};
