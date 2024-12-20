document.addEventListener('DOMContentLoaded', function() {
  // 初始化宝石价格下拉菜单
  const gemSelect = document.getElementById('gemPriceSelect');
  for(let i = 190; i <= 210; i++) {
    const option = document.createElement('option');
    option.value = (i / 100).toFixed(2);
    option.textContent = `¥${(i / 100).toFixed(2)}`;
    gemSelect.appendChild(option);
  }

  // 初始化补充包价格下拉菜单
  const packSelect = document.getElementById('packPriceSelect');
  for(let i = 242; i <= 270; i++) {
    const option = document.createElement('option');
    option.value = (i / 100).toFixed(2);
    option.textContent = `¥${(i / 100).toFixed(2)}`;
    packSelect.appendChild(option);
  }

  // 监听所有输入变化
  const inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(input => {
    input.addEventListener('input', function() {
      if (this.value < 0) this.value = 0;
      
      // 实时计算到手价格
      if (this.id === 'packPrice') {
        updateActualPrice(this.value);
      }
      
      updateDiscountRate();
      autoCalculate();
    });
  });

  // 监听单选框变化
  const radioInputs = document.querySelectorAll('input[type="radio"]');
  radioInputs.forEach(radio => {
    radio.addEventListener('change', autoCalculate);
  });

  // 下拉菜单事件监听
  document.getElementById('gemPriceSelect').addEventListener('change', function() {
    if (this.value) {
      document.getElementById('gemPrice').value = this.value;
      updateDiscountRate();
      autoCalculate();
    }
  });

  document.getElementById('packPriceSelect').addEventListener('change', function() {
    if (this.value) {
      document.getElementById('packPrice').value = this.value;
      updateActualPrice(this.value);
      updateDiscountRate();
      autoCalculate();
    }
  });

  // 清除按钮功能
  document.querySelectorAll('.clear-input').forEach(button => {
    button.addEventListener('click', function() {
      const inputId = this.getAttribute('data-for');
      const input = document.getElementById(inputId);
      if (input) {
        input.value = '';
        
        if (inputId === 'packPrice') {
          updateActualPrice('');
        }
        
        updateDiscountRate();
        autoCalculate();
      }
    });
  });
});

// 更新折扣率计算函数
function updateDiscountRate() {
  const gemPrice = parseFloat(document.getElementById('gemPrice').value) || 0;
  const packPrice = parseFloat(document.getElementById('packPrice').value) || 0;
  
  let discountRate = 0;
  if (packPrice > 0) {
    // 计算折扣率 = (宝石市场价格 / (补充包市场价格 / 1.15)) * 100
    discountRate = (gemPrice / (packPrice / 1.15)) * 100;
  }
  
  document.getElementById('discountRate').textContent = 
    discountRate > 0 ? `${discountRate.toFixed(2)}%` : '0%';
}

// 添加实时计算到手价格的函数
function updateActualPrice(marketPrice) {
  const actualPrice = marketPrice ? (parseFloat(marketPrice) / 1.15).toFixed(2) : '0.00';
  const actualPriceElement = document.getElementById('actualPrice');
  if (actualPriceElement) {
    actualPriceElement.textContent = `¥${actualPrice}元`;
  }
}

// 自动计算函数
function autoCalculate() {
  const cardCount = parseFloat(document.querySelector('input[name="cardCount"]:checked')?.value) || 0;
  const gemPrice = parseFloat(document.getElementById("gemPrice").value) || 0;
  const packPrice = parseFloat(document.getElementById("packPrice").value) || 0;

  // 检查是否所有值都已输入
  if (!cardCount || !gemPrice || !packPrice) {
    hideResult();
    return;
  }

  // 计算性价比
  // 计算公式：(宝石市场价格 * (卡片数量 / 1000)) / (补充包市场价格 / 1.15) * 100
  const total = ((gemPrice * (cardCount / 1000)) / (packPrice / 1.15)) * 100;

  showResult(`
    <h3>计算结果</h3>
    <div class="result-value">
      <span class="result-label">性价比折扣：</span>
      <span class="result-number">${total.toFixed(2)}折</span>
    </div>
  `);
}

function showResult(html) {
  const resultDiv = document.getElementById('result');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = html;
}

function hideResult() {
  const resultDiv = document.getElementById('result');
  resultDiv.style.display = 'none';
} 