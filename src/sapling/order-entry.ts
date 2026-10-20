document.querySelector('#start')?.addEventListener('click', () => {
  const worker = new Worker(new URL('./order.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = () => {
    document.querySelector('#status')!.textContent = 'Worker responded.';
  };
  document.querySelector('#status')!.textContent =
    'Worker started. Automated tests provide the fixture requests.';
});
