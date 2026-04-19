// ========== КОНФИГУРАЦИЯ ==========
const ORIGINAL_CARD_SIZE = 810;

let currentCardSize = 300;
let currentCanvasWidth = 800;
let currentCanvasHeight = 500;
let currentLeftX = 20;
let currentRightX = 420;
let currentY = 70;

// Глобальные переменные
let cardsDeck = [];
let places = [];
let gameState = 'loading';
let gameTime = 0;
let runTime = 0;
let rotateCards = true;

let allCardsData = {};
let cardImages = {};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const pauseBtn = document.getElementById('pauseBtn');
const newBtn = document.getElementById('newBtn');
const cardsCountSpan = document.getElementById('cardsCount');
const statusDiv = document.getElementById('status');
const loadingDiv = document.getElementById('loading');

// ========== РАСЧЁТ РАЗМЕРОВ ПОД ЭКРАН ==========
function calculateCanvasSize() {
    // Получаем размеры экрана
    const maxWidth = window.innerWidth - 20;
    const maxHeight = window.innerHeight - 70; // Отступ для панели сверху
    
    // Канвас занимает почти весь экран
    currentCanvasWidth = maxWidth;
    currentCanvasHeight = maxHeight;
    
    // 🔥 КАРТЫ ЗАНИМАЮТ 85% ВЫСОТЫ (почти всё пространство)
    currentCardSize = Math.floor(currentCanvasHeight * 0.85);
    
    // Ограничиваем максимальный размер
    if (currentCardSize > 500) currentCardSize = 500;
    if (currentCardSize < 200) currentCardSize = 200;
    
    // 🔥 МИНИМАЛЬНОЕ РАССТОЯНИЕ МЕЖДУ КАРТАМИ (5%)
    const gap = Math.floor(currentCardSize * 0.05);
    
    // Общая ширина двух карт + промежуток
    const totalWidth = currentCardSize * 2 + gap;
    
    // Центрируем по горизонтали
    currentLeftX = Math.floor((currentCanvasWidth - totalWidth) / 2);
    currentRightX = currentLeftX + currentCardSize + gap;
    
    // 🔥 ПО ВЕРТИКАЛИ: центрируем (равные отступы сверху и снизу)
    currentY = Math.floor((currentCanvasHeight - currentCardSize) / 2);
    
    // Устанавливаем размер канваса
    canvas.width = currentCanvasWidth;
    canvas.height = currentCanvasHeight;
    
    // CSS стили
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxWidth = `${currentCanvasWidth}px`;
    
    console.log(`Canvas: ${currentCanvasWidth}x${currentCanvasHeight}, CardSize: ${currentCardSize}, Gap: ${gap}px, Y: ${currentY}`);
}

// ========== ТАЙМЕР ==========
function startTimer() {
    setInterval(() => {
        if (gameState === 'started') {
            const now = Math.floor(Date.now() / 1000);
            runTime += now - gameTime;
            gameTime = now;
            const mins = Math.floor(runTime / 60);
            const secs = runTime % 60;
            pauseBtn.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }, 200);
}

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadGameData() {
    try {
        statusDiv.textContent = '📥 Загрузка данных карт...';
        const jsonResponse = await fetch('mini.json');
        allCardsData = await jsonResponse.json();
        
        const cardIds = Object.keys(allCardsData);
        statusDiv.textContent = `🖼️ Загрузка ${cardIds.length} карточек...`;
        
        const imagePromises = cardIds.map(id => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    cardImages[id] = img;
                    resolve();
                };
                img.onerror = () => reject(`Не удалось загрузить images/${id}.jpg`);
                img.src = `images/${id}.jpg`;
            });
        });
        
        await Promise.all(imagePromises);
        
        statusDiv.textContent = `✅ Готово!`;
        loadingDiv.style.display = 'none';
        gameState = 'stopped';
        
        newGame();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        statusDiv.textContent = '❌ Ошибка загрузки!';
        loadingDiv.innerHTML = `Ошибка: ${error}<br>Проверь папку images и mini.json`;
    }
}

// ========== ОТРИСОВКА КАРТЫ ==========
function drawCard(cardId, x, y, displaySize, angle) {
    const img = cardImages[cardId];
    if (!img) return;
    
    ctx.save();
    
    const centerX = x + displaySize/2;
    const centerY = y + displaySize/2;
    const radius = displaySize/2;
    
    // Круглая обрезка
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();
    
    // Поворот
    ctx.translate(centerX, centerY);
    ctx.rotate(angle * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    
    // Тень
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    
    // Рисуем картинку
    ctx.drawImage(img, x, y, displaySize, displaySize);
    
    ctx.shadowBlur = 0;
    
    ctx.restore();
    
    // Рамка
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
}

// ========== ОТРИСОВКА ВСЕЙ СЦЕНЫ ==========
function draw() {
    ctx.clearRect(0, 0, currentCanvasWidth, currentCanvasHeight);
    
    // Фон с градиентом
    const gradient = ctx.createLinearGradient(0, 0, currentCanvasWidth, currentCanvasHeight);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, currentCanvasWidth, currentCanvasHeight);
    
    if (places.length >= 2) {
        const leftCard = places[0];
        const rightCard = places[1];
        
        drawCard(leftCard.id, currentLeftX, currentY, currentCardSize, leftCard.angle);
        drawCard(rightCard.id, currentRightX, currentY, currentCardSize, rightCard.angle);
    }
}

// ========== НАХОЖДЕНИЕ ОБЩИХ СИМВОЛОВ ==========
function findCommonSymbols(cardId1, cardId2) {
    const symbols1 = new Set(Object.keys(allCardsData[cardId1]));
    const symbols2 = new Set(Object.keys(allCardsData[cardId2]));
    const common = [...symbols1].filter(s => symbols2.has(s));
    return common;
}

// ========== ПОЛУЧЕНИЕ СИМВОЛА ПО КООРДИНАТАМ ==========
function getSymbolAtClick(cardId, clickX, clickY, cardX, cardY, displaySize, angle) {
    const cardData = allCardsData[cardId];
    if (!cardData) return null;
    
    let localX = clickX - cardX;
    let localY = clickY - cardY;
    
    const centerX = displaySize / 2;
    const centerY = displaySize / 2;
    
    const rad = -angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const rotatedX = centerX + (localX - centerX) * cos - (localY - centerY) * sin;
    const rotatedY = centerY + (localX - centerX) * sin + (localY - centerY) * cos;
    
    const scale = displaySize / ORIGINAL_CARD_SIZE;
    const originalX = rotatedX / scale;
    const originalY = rotatedY / scale;
    
    let minDist = 65; // Увеличен радиус для удобства
    let foundSym = null;
    
    for (const [symId, coords] of Object.entries(cardData)) {
        const [origX, origY] = coords;
        const dist = Math.hypot(originalX - origX, originalY - origY);
        if (dist < minDist) {
            minDist = dist;
            foundSym = symId;
        }
    }
    return foundSym;
}

// ========== ПРОВЕРКА СОВПАДЕНИЯ ==========
function checkMatch(clickedSym, clickedCardId, otherCardId) {
    const common = findCommonSymbols(clickedCardId, otherCardId);
    
    if (common.includes(clickedSym)) {
        statusDiv.textContent = '✅ Правильно!';
        statusDiv.style.color = '#00ff00';
        setTimeout(() => { 
            if (gameState === 'started') {
                statusDiv.textContent = '🎯 Найди общий символ!';
                statusDiv.style.color = '#ffd700';
            }
        }, 800);
        
        places.shift();
        
        if (cardsDeck.length > 0) {
            const newCardId = drawCardFromDeck();
            if (newCardId !== null) {
                let angle = rotateCards ? Math.random() * 360 : 0;
                places.push({
                    id: newCardId,
                    angle: angle,
                    img: cardImages[newCardId]
                });
                cardsCountSpan.textContent = `📦 ${cardsDeck.length}`;
                statusDiv.textContent = `🎯 Осталось ${cardsDeck.length}`;
            }
        } else {
            gameState = 'stopped';
            statusDiv.textContent = '🏆 ПОБЕДА! 🏆';
            statusDiv.style.color = '#ffd700';
            pauseBtn.style.opacity = '0.6';
            return;
        }
        draw();
        
    } else {
        statusDiv.textContent = '❌ Не тот символ!';
        statusDiv.style.color = '#ff6666';
        setTimeout(() => {
            if (gameState === 'started') {
                statusDiv.textContent = '🎯 Найди общий символ!';
                statusDiv.style.color = '#ffd700';
            }
        }, 1000);
    }
}

// ========== ВЗЯТЬ КАРТУ ИЗ КОЛОДЫ ==========
function drawCardFromDeck() {
    if (cardsDeck.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * cardsDeck.length);
    const cardId = cardsDeck[randomIndex];
    cardsDeck.splice(randomIndex, 1);
    return cardId;
}

// ========== НОВАЯ ИГРА ==========
function newGame() {
    cardsDeck = Object.keys(allCardsData).map(Number);
    
    for (let i = cardsDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cardsDeck[i], cardsDeck[j]] = [cardsDeck[j], cardsDeck[i]];
    }
    
    const card1Id = drawCardFromDeck();
    const card2Id = drawCardFromDeck();
    
    if (card1Id === null || card2Id === null) {
        console.error('Недостаточно карт!');
        return;
    }
    
    const angle1 = rotateCards ? Math.random() * 360 : 0;
    const angle2 = rotateCards ? Math.random() * 360 : 0;
    
    places = [
        { id: card1Id, angle: angle1, img: cardImages[card1Id] },
        { id: card2Id, angle: angle2, img: cardImages[card2Id] }
    ];
    
    gameState = 'started';
    runTime = 0;
    gameTime = Math.floor(Date.now() / 1000);
    pauseBtn.textContent = '00:00';
    pauseBtn.style.opacity = '1';
    pauseBtn.style.background = '#1a1a2e';
    cardsCountSpan.textContent = `📦 ${cardsDeck.length}`;
    statusDiv.textContent = '🎯 Найди общий символ!';
    statusDiv.style.color = '#ffd700';
    
    draw();
}

// ========== ПАУЗА ==========
function togglePause() {
    if (gameState === 'started') {
        gameState = 'paused';
        pauseBtn.style.background = '#533483';
        statusDiv.textContent = '⏸️ Пауза';
    } else if (gameState === 'paused') {
        gameState = 'started';
        gameTime = Math.floor(Date.now() / 1000);
        pauseBtn.style.background = '#1a1a2e';
        statusDiv.textContent = '🎯 Найди общий символ!';
    } else if (gameState === 'stopped') {
        newGame();
    }
}

// ========== ОБРАБОТКА КЛИКА ==========
function handleClick(e) {
    if (gameState !== 'started') return;
    if (places.length < 2) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        e.preventDefault();
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    
    // Левая карта
    if (canvasX >= currentLeftX && canvasX <= currentLeftX + currentCardSize &&
        canvasY >= currentY && canvasY <= currentY + currentCardSize) {
        const leftCard = places[0];
        const sym = getSymbolAtClick(leftCard.id, canvasX, canvasY, currentLeftX, currentY, currentCardSize, leftCard.angle);
        if (sym) {
            checkMatch(sym, leftCard.id, places[1].id);
        }
    }
    
    // Правая карта
    if (canvasX >= currentRightX && canvasX <= currentRightX + currentCardSize &&
        canvasY >= currentY && canvasY <= currentY + currentCardSize) {
        const rightCard = places[1];
        const sym = getSymbolAtClick(rightCard.id, canvasX, canvasY, currentRightX, currentY, currentCardSize, rightCard.angle);
        if (sym) {
            checkMatch(sym, rightCard.id, places[0].id);
        }
    }
}

// ========== ОБРАБОТКА ПОВОРОТА ЭКРАНА ==========
function handleResize() {
    setTimeout(() => {
        calculateCanvasSize();
        draw();
    }, 50);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function init() {
    calculateCanvasSize();
    
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleClick(e);
    });
    
    pauseBtn.addEventListener('click', togglePause);
    newBtn.addEventListener('click', () => {
        if (gameState !== 'loading') {
            newGame();
            if (gameState === 'paused') gameState = 'started';
        }
    });
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    startTimer();
    loadGameData();
}

init();