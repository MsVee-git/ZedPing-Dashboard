// Resolve on the server's saved response, not merely when bytes leave the browser.
export function uploadRequest(input, init = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method || 'POST', String(input));
    xhr.timeout = 180000;
    new Headers(init.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) init.onUploadProgress?.(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => resolve(new Response(xhr.responseText, { status:xhr.status, headers:{'Content-Type':'application/json'} }));
    xhr.onerror = () => reject(new Error('Upload connection interrupted. Check the Content Library before retrying.'));
    xhr.ontimeout = () => reject(new Error('Saving took too long. Check the Content Library before retrying.'));
    xhr.send(init.body);
  });
}
