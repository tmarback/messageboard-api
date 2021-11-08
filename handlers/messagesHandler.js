'use strict'

module.exports = {
  getMessages: (req, res) => {
    
    res.status(200).json({
      page: 1,
      pageCount: 1,
      pages: []
    });

  },

  postMessage: (req, res) => {

    const timestamp = new Date().toISOString();
    res.status(201).json({
      id: 0,
      timestamp: timestamp,
    });

  }, 
};