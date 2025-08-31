// 説明やら何やら
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const randomGenBtn = document.getElementById('randomGenBtn');
const resetBtn = document.getElementById('resetBtn');

const speedSlider = document.getElementById('speedSlider');
const speedValueSpan = document.getElementById('speedValue');
let gameSpeed = 500; // ゲーム速度の初期値（ミリ秒

// 初期設定
const canvas = document.getElementById('lifeGameCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');

const cellSize = 3;

let width, height;
const snapToGrid = (value) => Math.floor(value / cellSize) * cellSize;

// UI要素の領域定義
let headerBox, innerBoxT, innerBoxB, bodyArea;

// 状態管理
let aliveCells = new Map(); // 位置と色を記録するMap 'x,y' -> color
let isGameRun = false;
let setupInterval, gameInterval;

// ユーザー入力データ
let userText = '';
let userImage = null;
let userImageDots = new Map();



// --- 初期化処理 ---
function initialize() {
  // キャンバスサイズ設定
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  
  // 各要素の領域を計算
  defineAreas();

  // イベントリスナーを設定
  setupEventListeners();

  // UI設定ループを開始
  startSetupLoop();
}



function defineAreas() {
  
  const rawHeaderHeight = height * 0.1;
  headerBox = {
    x: 0,
    y: 0,
    width: width,
    height: height * 0.1
  };

  const rawInnerBoxTWidth = width * 0.5;
  const rawInnerBoxTHeight = height * 0.08;
  // 仮のX座標を計算
  const tempInnerBoxTX = (width - rawInnerBoxTWidth - 150 - 5) / 2;
  // UI上のテキスト枠
  innerBoxT = {
    x: snapToGrid(tempInnerBoxTX),
    y: snapToGrid(headerBox.height * 2),
    width: snapToGrid(rawInnerBoxTWidth),
    height: snapToGrid(rawInnerBoxTHeight)
  };

  // UI上のボタン枠
  innerBoxB = {
    x: snapToGrid(innerBoxT.x + innerBoxT.width + 10),
    y: innerBoxT.y, // Y座標はinnerBoxTと同一
    width: snapToGrid(150),
    height: innerBoxT.height // 高さはinnerBoxTと同一
  };
    
  // bodyAreaは描画領域のリストとして定義
  bodyArea = {
    x: 0,
    y: headerBox.height,
    width: width,
    height: height - headerBox.height
  };

  // textInputの位置とサイズをinnerBoxTに合わせる
  textInput.style.left = `${innerBoxT.x}px`;
  textInput.style.top = `${innerBoxT.y}px`;
  textInput.style.width = `${innerBoxT.width}px`;
  textInput.style.height = `${innerBoxT.height}px`;

  // fileInputの位置をinnerBoxTの下に
  fileInput.style.left = `${innerBoxT.x}px`;
  fileInput.style.top = `${innerBoxT.y + innerBoxT.height + 10}px`;
}



function setupEventListeners() {
  //説明やら何やら
  menuBtn.addEventListener('click', () => {
      overlay.classList.remove('hidden');
  });

  // 閉じるボタンがクリックされたらオーバーレイを非表示
  closeBtn.addEventListener('click', () => {
      overlay.classList.add('hidden');
  });

  // ランダム生成ボタンがクリックされたら、生成関数を呼び出す
  randomGenBtn.addEventListener('click', generateRandomCells);

  // オーバーレイの背景部分がクリックされても非表示にする
  overlay.addEventListener('click', (e) => {
      // クリックされたのがモーダル自身でなく、背景の場合のみ閉じる
      if (e.target === overlay) {
          overlay.classList.add('hidden');
      }
  });

  //リセットボタン
  resetBtn.addEventListener('click', () => {
    window.location.reload();
    });

  //進行速度
  speedSlider.addEventListener('input', (e) => {
        // gameSpeed変数を更新
        gameSpeed = parseInt(e.target.value);
        speedValueSpan.textContent = `${(gameSpeed / 1000).toFixed(1)}秒`;
        // もしゲームが実行中なら、新しい速度でループを再開する
        if (isGameRun) {
            startGameLoop();
        }
    });


  // テキスト入力
  textInput.addEventListener('input', (e) => {
      userText = e.target.value;
  });

  // 画像入力
  fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  userImage = img;
                  // 画像が読み込まれたらすぐにドットに変換
                  userImageDots = convertImageToDots(userImage);
              }
              img.src = event.target.result;
          };
          reader.readAsDataURL(file);
      }
    });

  // クリック処理
  canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // ゲーム開始前
      if (!isGameRun) {
          // innerBoxB（確定ボタン）がクリックされたか
          if (x >= innerBoxB.x && x <= innerBoxB.x + innerBoxB.width &&
              y >= innerBoxB.y && y <= innerBoxB.y + innerBoxB.height) {
              clickButton();
          }
          // innerBoxT（テキスト入力エリア）がクリックされたか
          else if (x >= innerBoxT.x && x <= innerBoxT.x + innerBoxT.width &&
              y >= innerBoxT.y && y <= innerBoxT.y + innerBoxT.height) {
              textInput.focus();
          }
      }
  });
    
  // ウィンドウリサイズ
  window.addEventListener('resize', () => {
      if(!isGameRun) {
          initialize();
          if(userImage) {
              userImageDots = convertImageToDots(userImage);
          }
      }
  });
}



// ドット描画関連



function drawDot(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
}



// テキストをドットに変換して描画する関数
function getTextDots(text, startX, startY, colorFunc, fontSize,letterSpacing = '0px') {
    const dots = new Map();
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    const font = `${fontSize}px "MS Gothic", sans-serif`;
    tempCtx.font = font;
    tempCtx.letterSpacing = letterSpacing;
    const textMetrics = tempCtx.measureText(text);
    const textWidth = Math.ceil(textMetrics.width);
    const textHeight = Math.ceil(fontSize * 1.2);

    tempCanvas.width = textWidth;
    tempCanvas.height = textHeight;

    tempCtx.font = font;
    tempCtx.letterSpacing = letterSpacing;
    tempCtx.fillStyle = '#000000';
    tempCtx.fillText(text, 0, fontSize);

    const imageData = tempCtx.getImageData(0, 0, textWidth, textHeight).data;

    for (let y = 0; y < textHeight; y++) {
        for (let x = 0; x < textWidth; x++) {
            const alpha = imageData[(y * textWidth + x) * 4 + 3];
            if (alpha > 128) {
                const gridX = Math.floor((startX + x) / cellSize);
                const gridY = Math.floor((startY + y) / cellSize);
                const color = typeof colorFunc === 'function' ? colorFunc(x / textWidth) : colorFunc;
                dots.set(`${gridX},${gridY}`, color);
            }
        }
    }
    return dots;
}



// 画像をドットに変換する関数
function convertImageToDots(img) {
    const dots = new Map();
    const maxW = width * 0.8;
    const maxH = height * 0.6;

    let drawWidth = img.width;
    let drawHeight = img.height;
    const ratio = Math.min(maxW / drawWidth, maxH / drawHeight);
    drawWidth *= ratio;
    drawHeight *= ratio;
    
    const rawStartX = (width - drawWidth) / 2;
    const rawStartY = innerBoxT.y + innerBoxT.height + 20;

    // 開始座標をグリッドにスナップ
    const startX = snapToGrid(rawStartX);
    const startY = snapToGrid(rawStartY);

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = drawWidth;
    tempCanvas.height = drawHeight;
    tempCtx.drawImage(img, 0, 0, drawWidth, drawHeight);

    const imageData = tempCtx.getImageData(0, 0, drawWidth, drawHeight).data;
    
    for (let y = 0; y < drawHeight; y += cellSize) {
        for (let x = 0; x < drawWidth; x += cellSize) {
            const i = (Math.floor(y) * Math.floor(drawWidth) + Math.floor(x)) * 4;
            const r = imageData[i];
            const g = imageData[i+1];
            const b = imageData[i+2];
            const a = imageData[i+3];

            const threshold = 240; // 色、閾値

            if (a > 128 && !(r > threshold && g > threshold && b > threshold)) {
                const gridX = Math.floor((startX + x) / cellSize);
                const gridY = Math.floor((startY + y) / cellSize);
                dots.set(`${gridX},${gridY}`, `rgb(${r},${g},${b})`);
            }
        }
    }
    return dots;
}



//ランダムセル生成
function generateRandomCells() {
    // グリッドのサイズ取得
    const gridW = Math.floor(width / cellSize);
    const gridH = Math.floor(height / cellSize);
    const bodyTop = Math.floor(headerBox.height / cellSize) + 1;

    // 除外するinnerBoxのグリッド座標
    const gInnerTX = Math.floor(innerBoxT.x / cellSize);
    const gInnerTY = Math.floor(innerBoxT.y / cellSize);
    const gInnerTW = Math.floor(innerBoxT.width / cellSize);
    const gInnerTH = Math.floor(innerBoxT.height / cellSize);
    const gInnerBX = Math.floor(innerBoxB.x / cellSize);
    const gInnerBY = Math.floor(innerBoxB.y / cellSize);
    const gInnerBW = Math.floor(innerBoxB.width / cellSize);
    const gInnerBH = Math.floor(innerBoxB.height / cellSize);

    // bodyエリアの全座標をループして、ランダムにセル生成
    for (let y = bodyTop; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            // innerBoxの中は生成しない
            const inInnerT = (x >= gInnerTX && x < gInnerTX + gInnerTW && y >= gInnerTY && y < gInnerTY + gInnerTH);
            const inInnerB = (x >= gInnerBX && x < gInnerBX + gInnerBW && y >= gInnerBY && y < gInnerBY + gInnerBH);
            // 時計が表示されるエリアを除外する
            const clockZoneHeight = Math.ceil(60 / cellSize);
            const inClockZone = (y >= bodyTop && y < bodyTop + clockZoneHeight);
            if (inInnerT || inInnerB || inClockZone) {
                continue;
            }
            // 15%の確率でセルを生成
            if (Math.random() < 0.15) {
                const key = `${x},${y}`;
                if (!aliveCells.has(key)) {
                    const r = Math.floor(Math.random() * 256);
                    const g = Math.floor(Math.random() * 256);
                    const b = Math.floor(Math.random() * 256);
                    aliveCells.set(key, `rgb(${r},${g},${b})`);
                }
            }
        }
    }

    // 生成が終わったらメニュー閉じる
    overlay.classList.add('hidden');
    clickButton();
}



// ゲーム前、UIループ
function startSetupLoop() {
    if (setupInterval) clearInterval(setupInterval);
    setupInterval = setInterval(updateAndDrawSetup, 500); // ゲーム開始前、0.5秒単位で更新
}



function updateAndDrawSetup() {
  // キャンバスをクリア
  ctx.clearRect(0, 0, width, height);

  // aliveCellsをリセット
  aliveCells.clear(); // 前の記録を破棄

  // 背景描画
  // headerBox
  ctx.fillStyle = 'black';
  ctx.fillRect(headerBox.x, headerBox.y, headerBox.width, headerBox.height);

  // innerBoxT
  ctx.strokeStyle = 'black';
  ctx.lineWidth = cellSize;
  ctx.strokeRect(innerBoxT.x, innerBoxT.y, innerBoxT.width, innerBoxT.height);

  // innerBoxB
  ctx.strokeRect(innerBoxB.x, innerBoxB.y, innerBoxB.width, innerBoxB.height);


  // 各要素のドットを生成・描画し、aliveCellsに記録
    // headerText: "ライフゲーム"
    const headerFontSize = Math.min(headerBox.height * 0.6, 50);
    const headerStartX = snapToGrid((width - (headerFontSize * 5)) / 2);
    const headerStartY = snapToGrid((headerBox.height - headerFontSize) / 2);
    const headerTextDots = getTextDots("ライフゲーム", headerStartX, headerStartY,
        (p) => `hsl(${p * 360}, 100%, 70%)`,
        headerFontSize, '0px'
    );
    headerTextDots.forEach((color, key) => aliveCells.set(key, color));
    
    // clock、リアルタイム時計
    const now = new Date();
    const timeString = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const clockFontSize = 42;
    const clockLetterSpacing = '4px';

    ctx.font = `${clockFontSize}px "MS Gothic", sans-serif`; // 測定前にフォントを指定
    ctx.letterSpacing = clockLetterSpacing;
    const textMetrics = ctx.measureText(timeString);
    const textWidth = textMetrics.width;

    ctx.letterSpacing = '0px';

    const spaceTop = headerBox.height;
    const spaceBottom = innerBoxT.y;
    const spaceHeight = spaceBottom - spaceTop;

    const clockStartX = snapToGrid((width - textWidth) / 2);
    const clockStartY = snapToGrid(spaceTop + (spaceHeight - clockFontSize) / 2); //これで多分いい感じのところに表示される

    const clockTextDots = getTextDots(timeString, clockStartX, clockStartY, 'black', clockFontSize, clockLetterSpacing);
    clockTextDots.forEach((color, key) => aliveCells.set(key, color));
    
    // getText、入力テキスト
    if (userText) {
        const textFontSize = Math.min(innerBoxT.height * 0.75, 40);
        const textStartX = snapToGrid(innerBoxT.x + 10);
        const textStartY = snapToGrid(innerBoxT.y + (innerBoxT.height - textFontSize) / 2);
        const textDots = getTextDots(userText, textStartX, textStartY, 'black', textFontSize, '0px');
        textDots.forEach((color, key) => aliveCells.set(key, color));
    }

    // buttonText、"確定"
    const buttonFontSize = Math.min(innerBoxB.height * 0.6, 40);
    const buttonLabel = "確定";

    ctx.font = `${buttonFontSize}px "MS Gothic", sans-serif`;
    const buttonMetrics = ctx.measureText(buttonLabel);
    const buttonStartX = snapToGrid(innerBoxB.x + (innerBoxB.width - buttonMetrics.width) / 2);
    const buttonStartY = snapToGrid(innerBoxB.y + (innerBoxB.height - buttonFontSize) / 2);
    const buttonTextDots = getTextDots(buttonLabel, buttonStartX, buttonStartY, 'black', buttonFontSize, '6px');
    buttonTextDots.forEach((color, key) => aliveCells.set(key, color));

    // getImage、選択された画像
    if (userImage) {
        userImageDots.forEach((color, key) => aliveCells.set(key, color));
    }
    
    // aliveCellsをまとめて描画
    aliveCells.forEach((color, key) => {
        const [x, y] = key.split(',').map(Number);
        drawDot(x, y, color);
    });
}



// ゲーム開始処理
function clickButton() {
    isGameRun = true;
    clearInterval(setupInterval); // ゲーム前のループ更新を止める

    // 無効化
    textInput.disabled = true;
    textInput.style.display = 'none';
    fileInput.disabled = true;
    fileInput.style.display = 'none';
    
    // ゲームループを開始
    startGameLoop();
}



// ゲームループ
function startGameLoop() {
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(updateAndDrawGame, gameSpeed); // ライフゲームの進行速度
}


//基本ルール
function updateAndDrawGame() {
    const nextGeneration = new Map();
    const neighborsCount = new Map();
    const neighborColors = new Map();
    
    const gridW = Math.floor(width / cellSize);
    const gridH = Math.floor(height / cellSize);

    // 各セルの隣接セルをカウント
    aliveCells.forEach((color, key) => {
        const [x, y] = key.split(',').map(Number);
        const cellZone = getZone(x, y);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;

                const { nx, ny } = getNeighborCoords(x, y, dx, dy, cellZone, gridW, gridH);

                const neighborKey = `${nx},${ny}`;
                const currentCount = neighborsCount.get(neighborKey) || 0;
                neighborsCount.set(neighborKey, currentCount + 1);

                const colors = neighborColors.get(neighborKey) || [];
                colors.push(color);
                neighborColors.set(neighborKey, colors);
            }
        }
    });

    // 次世代
    neighborsCount.forEach((count, key) => {
        const [x, y] = key.split(',').map(Number);
        const isAlive = aliveCells.has(key);
        
        // 誕生、死セルで隣接が3つ
        if (!isAlive && count === 3) {
            const candidateColors = neighborColors.get(key);
            const newColor = candidateColors[Math.floor(Math.random() * candidateColors.length)];
            nextGeneration.set(key, newColor);
        }
        // 生存、生セルで隣接が2つか3つ
        else if (isAlive && (count === 2 || count === 3)) {
            nextGeneration.set(key, aliveCells.get(key));
        }
        // 過疎、過密、そのままでおk
    });
    
    aliveCells = nextGeneration;

    // 描画
    ctx.clearRect(0, 0, width, height);
    
    // 背景描画
    ctx.fillStyle = 'black';
    ctx.fillRect(headerBox.x, headerBox.y, headerBox.width, headerBox.height);
    ctx.lineWidth = cellSize;
    ctx.strokeRect(innerBoxT.x, innerBoxT.y, innerBoxT.width, innerBoxT.height);
    ctx.strokeRect(innerBoxB.x, innerBoxB.y, innerBoxB.width, innerBoxB.height);

    // 生セル描画
    aliveCells.forEach((color, key) => {
        const [x, y] = key.split(',').map(Number);
        drawDot(x, y, color);
    });
}



// 追加ルール


// セルがどのエリアにいるか判定
function getZone(x, y) {
    const worldX = x * cellSize;
    const worldY = y * cellSize;

    if (worldY < headerBox.height) return 'header';

    if (worldX >= innerBoxT.x && worldX < innerBoxT.x + innerBoxT.width &&
        worldY >= innerBoxT.y && worldY < innerBoxT.y + innerBoxT.height) return 'innerT';

    if (worldX >= innerBoxB.x && worldX < innerBoxB.x + innerBoxB.width &&
        worldY >= innerBoxB.y && worldY < innerBoxB.y + innerBoxB.height) return 'innerB';

    return 'body';
}



// 境界トーラス、innerBox貫通
function getNeighborCoords(x, y, dx, dy, zone, gridW, gridH) {
    let nx = x + dx;
    let ny = y + dy;

    const gHeaderY = Math.floor(headerBox.y / cellSize);
    const gHeaderH = Math.floor(headerBox.height / cellSize);
    const gInnerTX = Math.floor(innerBoxT.x / cellSize);
    const gInnerTY = Math.floor(innerBoxT.y / cellSize);
    const gInnerTW = Math.floor(innerBoxT.width / cellSize);
    const gInnerTH = Math.floor(innerBoxT.height / cellSize);
    const gInnerBX = Math.floor(innerBoxB.x / cellSize);
    const gInnerBY = Math.floor(innerBoxB.y / cellSize);
    const gInnerBW = Math.floor(innerBoxB.width / cellSize);
    const gInnerBH = Math.floor(innerBoxB.height / cellSize);
    const gBodyY = gHeaderH + 1;  //+1したらいけたヘッダーエリアと干渉してた？
    const gBodyH = gridH - gBodyY;


    switch (zone) {
        case 'header':
            if (nx < 0) nx = gridW - 1;
            if (nx >= gridW) nx = 0;
            if (ny < gHeaderY) ny = gHeaderH - 1;
            if (ny >= gHeaderH) ny = gHeaderY;
            break;
        case 'innerT':
            if (nx < gInnerTX) nx = gInnerTX + gInnerTW - 1;
            if (nx >= gInnerTX + gInnerTW) nx = gInnerTX;
            if (ny < gInnerTY) ny = gInnerTY + gInnerTH - 1;
            if (ny >= gInnerTY + gInnerTH) ny = gInnerTY;
            break;
        case 'innerB':
             if (nx < gInnerBX) nx = gInnerBX + gInnerBW - 1;
            if (nx >= gInnerBX + gInnerBW) nx = gInnerBX;
            if (ny < gInnerBY) ny = gInnerBY + gInnerBH - 1;
            if (ny >= gInnerBY + gInnerBH) ny = gInnerBY;
            break;
        case 'body':
            const nextWorldX = nx * cellSize;
            const nextWorldY = ny * cellSize;

            const hitInnerT = nextWorldX >= innerBoxT.x && nextWorldX < innerBoxT.x + innerBoxT.width &&
                            nextWorldY >= innerBoxT.y && nextWorldY < innerBoxT.y + innerBoxT.height;
            const hitInnerB = nextWorldX >= innerBoxB.x && nextWorldX < innerBoxB.x + innerBoxB.width &&
                            nextWorldY >= innerBoxB.y && nextWorldY < innerBoxB.y + innerBoxB.height;

            if (hitInnerT) {
                // innerBoxTに接触した場合、来た方向に応じて反対側にワープさせる
                if (dy > 0) ny = gInnerTY + gInnerTH;
                else if (dy < 0) ny = gInnerTY - 1;
                else if (dx > 0) nx = gInnerTX + gInnerTW;
                else if (dx < 0) nx = gInnerTX - 1;
            }
            else if (hitInnerB) {
                // innerBoxBに接触した場合も同様
                if (dy > 0) ny = gInnerBY + gInnerBH;
                else if (dy < 0) ny = gInnerBY - 1;
                else if (dx > 0) nx = gInnerBX + gInnerBW;
                else if (dx < 0) nx = gInnerBX - 1;
            }
            // 外側トーラス
            if (nx < 0) nx = gridW - 1;
            if (nx >= gridW) nx = 0;
            if (ny < gBodyY) ny = gridH - 1;
            if (ny >= gridH) ny = gBodyY;
            break;
    }

    return { nx, ny };
}

document.addEventListener('DOMContentLoaded', initialize);
