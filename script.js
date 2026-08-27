let type='airtime';
const rates={MTN:{airtime:.75,data:.70},Airtel:{airtime:.75,data:.70},Glo:{airtime:.72,data:.68},"9mobile":{airtime:.70,data:.65}};
function setType(t){type=t;document.getElementById('airTab').classList.toggle('active',t==='airtime');document.getElementById('dataTab').classList.toggle('active',t==='data');document.getElementById('amountLabel').textContent=t==='airtime'?'Airtime amount (₦)':'Data value (₦)';calculate()}
function calculate(){let n=document.getElementById('network').value;let a=parseFloat(document.getElementById('amount').value)||0;document.getElementById('cash').textContent='₦'+(a*rates[n][type]).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}
document.getElementById('network').addEventListener('change',calculate);
function submitConversion(){let a=Number(document.getElementById('amount').value);let acct=document.getElementById('account').value.trim();if(!a||a<100)return alert('Please enter an amount of at least ₦100.');if(!/^\d{10}$/.test(acct))return alert('Please enter a valid 10-digit account number.');alert('Demo conversion created successfully. Connect the backend/API to process real transactions.')}
function openModal(){document.getElementById('modal').classList.add('show')}function closeModal(){document.getElementById('modal').classList.remove('show')}
