// ========== КОНФИГУРАЦИЯ ==========
const ORIGINAL_CARD_SIZE = 810;   // реальный размер карты из mini.json
const CARD_SIZE = 360;            // отображаемый размер на канвасе
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;
const SHIFT = 20;

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
        
        console.log(`Найдено карт в JSON: ${cardIds.length}`); // Отладка
        
        const imagePromises = cardIds.map(id => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    cardImages[id] = img;
                    console.log(`Загружена карта ${id}`);
                    resolve();
                };
                img.onerror = () => reject(`Не удалось загрузить images/${id}.jpg`);
                img.src = `images/${id}.jpg`;
            });
        });
        
        await Promise.all(imagePromises);
        
        const loadedCount = Object.keys(cardImages).length;
        statusDiv.textContent = `✅ Загружено ${loadedCount} карт!`;
        console.log(`Загружено изображений: ${loadedCount}`);
        
        loadingDiv.style.display = 'none';
        gameState = 'stopped';
        
        newGame();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        statusDiv.textContent = '❌ Ошибка загрузки!';
        loadingDiv.innerHTML = `Ошибка: ${error}<br>Проверь папку images и mini.json`;
    }
}

// ========== ОТРИСОВКА КАРТЫ С КРУГЛОЙ МАСКОЙ ==========
function drawCard(cardId, x, y, displaySize, angle) {
    const img = cardImages[cardId];
    if (!img) return;
    
    ctx.save();
    
    const centerX = x + displaySize/2;
    const centerY = y + displaySize/2;
    
    // 1. Создаём круглую маску (обрезку)
    ctx.beginPath();
    ctx.arc(centerX, centerY, displaySize/2, 0, Math.PI * 2);
    ctx.clip();  // Всё, что рисуется дальше, будет обрезано по кругу
    
    // 2. Поворачиваем
    ctx.translate(centerX, centerY);
    ctx.rotate(angle * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    
    // 3. Тень (немного смещаем, чтобы не обрезалась краями)
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    
    // 4. Рисуем картинку
    ctx.drawImage(img, x, y, displaySize, displaySize);
    
    // 5. Сбрасываем тень для рамки
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // 6. Круглая цветная рамка
    ctx.beginPath();
    ctx.arc(centerX, centerY, displaySize/2 - 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // 7. Внешний белый ободок (опционально, для красоты)
    ctx.beginPath();
    ctx.arc(centerX, centerY, displaySize/2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
}

// ========== ОТРИСОВКА ВСЕЙ СЦЕНЫ ==========
function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (places.length >= 2) {
        const leftCard = places[0];
        const rightCard = places[1];
        
        const cardWidth = CARD_SIZE;
        const cardHeight = CARD_SIZE;
        const leftX = SHIFT;
        const rightX = CANVAS_WIDTH - cardWidth - SHIFT;
        const y = (CANVAS_HEIGHT - cardHeight) / 2;
        
        drawCard(leftCard.id, leftX, y, cardWidth, leftCard.angle);
        drawCard(rightCard.id, rightX, y, cardWidth, rightCard.angle);
    }
}

// ========== НАХОЖДЕНИЕ ОБЩИХ СИМВОЛОВ ==========
function findCommonSymbols(cardId1, cardId2) {
    const symbols1 = new Set(Object.keys(allCardsData[cardId1]));
    const symbols2 = new Set(Object.keys(allCardsData[cardId2]));
    const common = [...symbols1].filter(s => symbols2.has(s));
    return common;
}

// ========== ПОЛУЧЕНИЕ СИМВОЛА ПО КООРДИНАТАМ (С УЧЁТОМ МАСШТАБА И ПОВОРОТА) ==========
function getSymbolAtClick(cardId, clickX, clickY, cardX, cardY, displaySize, angle) {
    const cardData = allCardsData[cardId];
    if (!cardData) return null;
    
    // Локальные координаты внутри отображаемой карты
    let localX = clickX - cardX;
    let localY = clickY - cardY;
    
    // Центр карты
    const centerX = displaySize / 2;
    const centerY = displaySize / 2;
    
    // Обратный поворот
    const rad = -angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const rotatedX = centerX + (localX - centerX) * cos - (localY - centerY) * sin;
    const rotatedY = centerY + (localX - centerX) * sin + (localY - centerY) * cos;
    
    // Масштаб: от оригинального размера к отображаемому (displaySize)
    const scale = displaySize / ORIGINAL_CARD_SIZE;
    
    // Переводим координаты в оригинальный размер для сравнения с JSON
    const originalX = rotatedX / scale;
    const originalY = rotatedY / scale;
    
    let minDist = 55; // радиус в оригинальных пикселях
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
        statusDiv.textContent = '✅ Правильно! +1 карта';
        statusDiv.style.color = '#00ff00';
        setTimeout(() => { if (gameState === 'started') statusDiv.style.color = '#ffd700'; }, 800);
        
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
                cardsCountSpan.textContent = `📦 Карт: ${cardsDeck.length}`;
                statusDiv.textContent = `🎯 Осталось ${cardsDeck.length} карт!`;
            }
        } else {
            gameState = 'stopped';
            statusDiv.textContent = '🏆 ПОБЕДА! 🏆';
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
    cardsCountSpan.textContent = `📦 Карт: ${cardsDeck.length}`;
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
    
    const cardWidth = CARD_SIZE;
    const cardHeight = CARD_SIZE;
    const leftX = SHIFT;
    const rightX = CANVAS_WIDTH - cardWidth - SHIFT;
    const y = (CANVAS_HEIGHT - cardHeight) / 2;
    
    // Левая карта
    if (canvasX >= leftX && canvasX <= leftX + cardWidth &&
        canvasY >= y && canvasY <= y + cardHeight) {
        const leftCard = places[0];
        const sym = getSymbolAtClick(leftCard.id, canvasX, canvasY, leftX, y, cardWidth, leftCard.angle);
        if (sym) {
            checkMatch(sym, leftCard.id, places[1].id);
        }
    }
    
    // Правая карта
    if (canvasX >= rightX && canvasX <= rightX + cardWidth &&
        canvasY >= y && canvasY <= y + cardHeight) {
        const rightCard = places[1];
        const sym = getSymbolAtClick(rightCard.id, canvasX, canvasY, rightX, y, cardWidth, rightCard.angle);
        if (sym) {
            checkMatch(sym, rightCard.id, places[0].id);
        }
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function init() {
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
    
    startTimer();
    loadGameData();
}

init();