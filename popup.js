const RSS_URL = 'https://www.lostfilm.download/rss.xml';
let currentPeriod = 'day';

// Функция для отслеживания изменения системной темы
function watchSystemTheme() {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e) => {
        if (e.matches) {
            document.body.style.backgroundColor = 'var(--bg-primary)';
        } else {
            document.body.style.backgroundColor = 'var(--bg-primary)';
        }
    };
    
    // Слушаем изменения темы
    darkModeMediaQuery.addEventListener('change', handleThemeChange);
}

function isWithinPeriod(date, period) {
    const now = new Date();
    const diff = now - date;
    return period === 'day' ? diff <= 86400000 : diff <= 604800000;
}

function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatWeekday(date) {
    return date.toLocaleDateString('ru-RU', { weekday: 'short' });
}

function cleanDescription(rawDescription) {
    if (!rawDescription) return '';
    let clean = rawDescription.replace(/<[^>]*>/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
    clean = clean.replace(/Дата выхода.*$/i, '');
    clean = clean.replace(/Рейтинг:.*$/i, '');
    clean = clean.replace(/\s*\/\s*[A-Za-z][^\.]*$/, '');
    clean = clean.replace(/\.$/, '');
    return clean.trim();
}

function parseItem(title, description, link) {
    const isSeries = link.includes('/series/');
    const isMovie = link.includes('/movie/') || title.includes('(Фильм)');
    
    if (isMovie) {
        let movieTitle = title.replace(/\s*\(Фильм\)$/, '').trim();
        return {
            type: 'movie',
            title: movieTitle,
            original: '',
            season: '',
            episode: '',
            episodeTitle: ''
        };
    }
    
    if (isSeries) {
        let seriesTitle = '';
        let originalTitle = '';
        let episodeTitle = '';
        let season = '';
        let episode = '';
        
        const mainMatch = title.match(/^(.+?)\s*\/\s*(.+?)\s*\(/);
        if (mainMatch) {
            seriesTitle = mainMatch[1].trim();
            originalTitle = mainMatch[2].trim();
        } else {
            seriesTitle = title.replace(/\s*\([^)]*\)$/, '').trim();
        }
        
        let seasonMatch = title.match(/\((\d+)\s+сезон\s+(\d+)\s+серия\)/);
        if (seasonMatch) {
            season = seasonMatch[1];
            episode = seasonMatch[2];
        } else {
            let sEpsMatch = title.match(/S(\d+)E(\d+)/i);
            if (sEpsMatch) {
                season = String(parseInt(sEpsMatch[1]));
                episode = String(parseInt(sEpsMatch[2]));
            }
        }
        
        const cleanDesc = cleanDescription(description);
        if (cleanDesc && !cleanDesc.includes('http') && cleanDesc.length < 200) {
            episodeTitle = cleanDesc;
        }
        
        return {
            type: 'series',
            title: seriesTitle,
            original: originalTitle,
            season: season,
            episode: episode,
            episodeTitle: episodeTitle
        };
    }
    
    return null;
}

function renderItem(item, showDate) {
    let typeText = '';
    if (item.type === 'movie') {
        typeText = '🎬 Фильм';
    } else if (item.season && item.episode) {
        typeText = `📺 ${item.season}x${item.episode}`;
    } else {
        typeText = '📺 Сериал';
    }
    
    const episodeHtml = item.episodeTitle ? `
        <div class="episode-desc">
            📖 ${escapeHtml(item.episodeTitle)}
        </div>
    ` : '';
    
    const originalHtml = item.original ? ` ${escapeHtml(item.original)}` : '';
    
    return `
        <a href="${escapeHtml(item.link)}" target="_blank" class="item">
            <div class="title">
                <span class="title-rus">${escapeHtml(item.title)}</span>
                <span class="title-orig">${originalHtml}</span>
            </div>
            ${episodeHtml}
            <div class="info">
                <span>${typeText}</span>
                ${showDate ? `<span>📅 ${item.date}</span>` : ''}
                <span>🕐 ${item.time}</span>
            </div>
        </a>
    `;
}

async function load() {
    const container = document.getElementById('content');
    container.innerHTML = '<div class="loader"><div class="spinner"></div>Загрузка...</div>';
    
    try {
        const response = await fetch(RSS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        const xml = new DOMParser().parseFromString(text, 'text/xml');
        
        const parserError = xml.querySelector('parsererror');
        if (parserError) {
            throw new Error('Не удалось распарсить RSS ленту');
        }
        
        const items = xml.querySelectorAll('item');
        const results = [];
        
        for (const item of items) {
            const title = item.querySelector('title')?.textContent;
            const pubDateEl = item.querySelector('pubDate');
            const link = item.querySelector('link')?.textContent;
            const description = item.querySelector('description')?.textContent || '';
            
            if (!title || !pubDateEl || !link) continue;
            
            const pubDate = new Date(pubDateEl.textContent);
            if (isNaN(pubDate.getTime()) || !isWithinPeriod(pubDate, currentPeriod)) continue;
            
            const parsed = parseItem(title, description, link);
            if (!parsed) continue;
            
            results.push({
                ...parsed,
                link,
                date: formatDate(pubDate),
                weekday: formatWeekday(pubDate),
                fullDate: pubDate.toLocaleDateString('ru-RU'),
                time: formatTime(pubDate)
            });
        }
        
        if (results.length === 0) {
            container.innerHTML = `<div class="empty">✨ За ${currentPeriod === 'day' ? '24 часа' : 'неделю'} новинок нет</div>`;
            return;
        }
        
        results.sort((a, b) => b.fullDate.localeCompare(a.fullDate));
        
        let html = '';
        if (currentPeriod === 'day') {
            for (const item of results) {
                html += renderItem(item, true);
            }
        } else {
            const groups = {};
            for (const item of results) {
                const key = item.fullDate;
                if (!groups[key]) {
                    groups[key] = { date: item.date, weekday: item.weekday, items: [] };
                }
                groups[key].items.push(item);
            }
            
            const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));
            for (const dayKey of sortedDays) {
                const group = groups[dayKey];
                html += `<div class="day-header">${group.weekday}, ${group.date}</div>`;
                for (const item of group.items) {
                    html += renderItem(item, false);
                }
            }
        }
        
        container.innerHTML = html;
        
    } catch (err) {
        console.error('Ошибка:', err);
        
        let errorMessage = 'Не удалось загрузить данные';
        if (err.message.includes('Failed to fetch')) {
            errorMessage = 'Нет подключения к интернету';
        } else if (err.message.includes('403')) {
            errorMessage = 'Доступ запрещён. Попробуйте позже.';
        } else {
            errorMessage = err.message;
        }
        
        container.innerHTML = `<div class="empty">
            ⚠️ Ошибка<br>
            <small style="font-size: 11px; margin-top: 8px; display: block;">${escapeHtml(errorMessage)}</small>
        </div>`;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function setPeriod(period) {
    currentPeriod = period;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    load();
}

function closePopup() {
    window.close();
}

// Запускаем отслеживание системной темы
watchSystemTheme();

// Назначаем обработчики
document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => setPeriod(btn.dataset.period));
});

document.getElementById('refreshBtn').addEventListener('click', () => {
    load();
});

const closeBtn = document.getElementById('closeBtn');
if (closeBtn) {
    closeBtn.addEventListener('click', closePopup);
}

// Загружаем данные
load();