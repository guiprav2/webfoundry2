import lf from 'https://cdn.skypack.dev/localforage';

self.addEventListener('fetch', event => {
  // Assuming the URL pattern to check is something like '/files/yourfile.jpg'
  if (event.request.url.includes('/files/')) {
    const url = new URL(event.request.url);
    const path = url.pathname;
    
    // Extract the file name and prepend with 'file:' to match the localForage key
    const parts = path.slice(path.indexOf('/files/') + '/files/'.length).split('/');
    const site = parts.shift();
    const fileKey = 'file:' + site + ':' + parts.join('/');

    event.respondWith(lf.getItem(fileKey).then(file => {
      if (file) {
        return new Response(file);
      } else {
        return new Response('File not found', { status: 404 });
      }
    }).catch(error => {
      return new Response('Error fetching file: ' + error, { status: 500 });
    })
    );
  }
});