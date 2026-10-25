const checkButton = document.querySelector('#check-button');
const result = document.querySelector('#result');

checkButton.addEventListener('click', () => {
  result.textContent = '動作確認に成功しました';
  result.classList.add('is-visible');
});
