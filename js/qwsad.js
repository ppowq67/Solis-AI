(async () => {
           const API_BASE = window.API_BASE_URL || 'https://api.solisai.video/api';
           try {
               const response = await fetch(`${API_BASE}/auth/check`, {
                   method: 'GET',
                   credentials: 'include'
               });
               if (!response.ok) {
                   window.location.href = '/welcome.html';
               }
           } catch (error) {
               window.location.href = '/login.html';
           }
       })();
