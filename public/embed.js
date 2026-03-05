// BetMate Embed Script
// Add this to any page: <script src="https://betmate.vercel.app/embed.js"></script>

(function() {
  'use strict';

  const BETMATE_URL = window.BETMATE_URL || 'https://betmate.vercel.app';
  
  // Create iframe container
  const container = document.createElement('div');
  container.id = 'betmate-container';
  container.innerHTML = `
    <style>
      #betmate-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      #betmate-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(5, 150, 105, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      #betmate-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 25px rgba(5, 150, 105, 0.5);
      }
      
      #betmate-iframe {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        height: 600px;
        border: none;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        display: none;
        z-index: 999999;
      }
      
      #betmate-iframe.open {
        display: block;
      }
      
      @media (max-width: 480px) {
        #betmate-iframe {
          width: 100%;
          height: 100%;
          bottom: 0;
          right: 0;
          border-radius: 0;
        }
      }
    </style>
    
    <button id="betmate-button" aria-label="Open BetMate chat">
      💬
    </button>
    
    <iframe 
      id="betmate-iframe" 
      src="${BETMATE_URL}/widget" 
      title="BetMate Chat"
      allow="clipboard-write"
    ></iframe>
  `;
  
  document.body.appendChild(container);
  
  const button = document.getElementById('betmate-button');
  const iframe = document.getElementById('betmate-iframe');
  
  button.addEventListener('click', function() {
    if (iframe.classList.contains('open')) {
      iframe.classList.remove('open');
      button.style.display = 'flex';
    } else {
      iframe.classList.add('open');
      button.style.display = 'none';
    }
  });
  
  // Listen for close message from iframe
  window.addEventListener('message', function(event) {
    if (event.data === 'betmate:close') {
      iframe.classList.remove('open');
      button.style.display = 'flex';
    }
  });
  
  // Expose global API
  window.BetMate = {
    open: function() {
      iframe.classList.add('open');
      button.style.display = 'none';
    },
    close: function() {
      iframe.classList.remove('open');
      button.style.display = 'flex';
    },
    toggle: function() {
      if (iframe.classList.contains('open')) {
        this.close();
      } else {
        this.open();
      }
    }
  };
})();
