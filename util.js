function makePromise() {
  let res, rej, p = new Promise((resolve, reject) => {
    res = resolve;
    rej = reject;
  });
  return [p, res, rej];
}

async function showModal(x) {
  let [p, res] = makePromise();
  document.body.append(x);
  x.returnValue = '';
  x.addEventListener('close', () => {
    x.remove();
    res([x.returnValue, x.returnValue2]);
  });
  x.showModal();
  return p;
}

export { makePromise, showModal };