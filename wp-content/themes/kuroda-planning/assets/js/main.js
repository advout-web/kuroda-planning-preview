/**
 * Kuroda Planning Theme - main.js（依存ライブラリなし）
 * ローディング／文字の分割と波／ハッシュタグのタイピング／FV のリアクション／スクロール出現／ヘッダー
 */
(function () {
	'use strict';

	var doc = document;
	var html = doc.documentElement;
	var body = doc.body;
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var isShot = html.classList.contains('is-shot') || /[?&]shot=1/.test(location.search);
	if (isShot) html.classList.add('is-shot');

	/* ---------- 文字分割 ---------- */
	function splitChars(el, offset) {
		if (el.dataset.split) return offset;
		var text = el.textContent;
		if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', text.trim());
		el.textContent = '';
		Array.prototype.forEach.call(text, function (ch) {
			var span = doc.createElement('span');
			span.className = 'char';
			span.style.setProperty('--i', offset++);
			span.textContent = ch;
			span.setAttribute('aria-hidden', 'true');
			el.appendChild(span);
		});
		el.dataset.split = '1';
		return offset;
	}
	doc.querySelectorAll('.js-split').forEach(function (el) { splitChars(el, 0); });
	// FV のキャッチ：見出し全体で通し番号を振り、行ごとに少し遅らせる
	(function () {
		var catchEl = doc.querySelector('.fv__catch');
		if (!catchEl) return;
		catchEl.setAttribute('aria-label', catchEl.textContent.replace(/\s+/g, ''));
		var n = 0;
		catchEl.querySelectorAll('.js-wave').forEach(function (el) { n = splitChars(el, n); });
	})();

	/* ---------- ローディング（初回はしっかり、2ページ目以降は短く） ---------- */
	var loader = doc.querySelector('.loader');
	var started = false;
	function start() {
		if (started) return;
		started = true;
		if (loader) {
			loader.classList.add('is-done');
			setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 1200);
		}
		body.classList.remove('is-loading');
		setTimeout(function () { body.classList.add('is-ready'); startTyping(); startReactions(); }, loader ? 250 : 0);
	}
	if (loader && !reduceMotion && !isShot) {
		var seen = false;
		try { seen = sessionStorage.getItem('kp_seen') === '1'; sessionStorage.setItem('kp_seen', '1'); } catch (e) {}
		var minTime = seen ? 800 : 1900;
		if (seen) loader.classList.add('is-quick');
		body.classList.add('is-loading');
		var t0 = Date.now();
		var release = function () { setTimeout(start, Math.max(0, minTime - (Date.now() - t0))); };
		if (doc.readyState === 'complete') release(); else window.addEventListener('load', release);
		setTimeout(start, 4500); // 読み込みが遅いときの保険
	} else {
		if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
		loader = null;
		start();
	}

	/* ---------- FV：ハッシュタグのタイピング ---------- */
	function startTyping() {
		var el = doc.querySelector('.js-typing');
		if (!el || reduceMotion || isShot) return;
		var words;
		try { words = JSON.parse(el.dataset.words); } catch (e) { return; }
		if (!words || !words.length) return;
		var wi = 0, ci = words[0].length, deleting = false;
		function tick() {
			var word = words[wi];
			if (!deleting) {
				ci++;
				if (ci > word.length) { deleting = true; return setTimeout(tick, 1700); }
			} else {
				ci--;
				if (ci <= 1) { deleting = false; wi = (wi + 1) % words.length; ci = 1; }
			}
			el.textContent = words[wi].slice(0, Math.max(ci, 1));
			setTimeout(tick, deleting ? 40 : 90);
		}
		setTimeout(function () { deleting = true; tick(); }, 2600);
	}

	/* ---------- FV：いいね・コメントが下から湧き上がる ---------- */
	function startReactions() {
		var box = doc.querySelector('.fv__reactions');
		var fv = doc.querySelector('.fv');
		if (!box || !fv || reduceMotion || isShot) return;
		var icons = {
			heart: '<path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z"/>',
			comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
			bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
			spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19"/>'
		};
		var types = ['heart', 'heart', 'heart', 'comment', 'bookmark', 'spark'];
		var visible = true, timer = null;
		function spawn() {
			if (!visible || doc.hidden) return;
			var type = types[Math.floor(Math.random() * types.length)];
			var el = doc.createElement('span');
			el.className = 'reaction reaction--' + type;
			el.innerHTML = '<span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + icons[type] + '</svg></span>';
			var wide = window.innerWidth > 1024;
			el.style.left = (wide ? 48 + Math.random() * 48 : 6 + Math.random() * 86) + '%';
			el.style.setProperty('--dur', (6 + Math.random() * 4).toFixed(1) + 's');
			el.style.scale = (0.7 + Math.random() * 0.5).toFixed(2);
			box.appendChild(el);
			setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 11000);
		}
		function loop() { spawn(); timer = setTimeout(loop, 700 + Math.random() * 900); }
		if ('IntersectionObserver' in window) {
			new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(fv);
		}
		loop();
	}

	/* ---------- スクロールで表示（見出しは出たあと、波が定期的に通る） ---------- */
	(function () {
		var targets = doc.querySelectorAll('.reveal, .reveal-stagger, .js-split');
		var settle = function (el) {
			if (!el.classList.contains('js-split')) return;
			var n = el.querySelectorAll('.char').length;
			setTimeout(function () { el.classList.add('is-settled'); }, 900 + n * 32);
		};
		if (!('IntersectionObserver' in window) || reduceMotion || isShot) {
			targets.forEach(function (el) { el.classList.add('is-in'); if (!reduceMotion && !isShot) settle(el); });
			return;
		}
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-in');
					settle(entry.target);
					io.unobserve(entry.target);
				}
			});
		}, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
		targets.forEach(function (el) { io.observe(el); });
	})();

	/* ---------- ヘッダー・ページトップ ---------- */
	(function () {
		var header = doc.getElementById('site-header');
		var pagetop = doc.querySelector('.pagetop');
		var lastY = window.pageYOffset;
		var ticking = false;
		function onScroll() {
			var y = window.pageYOffset;
			if (header) {
				header.classList.toggle('is-scrolled', y > 20);
				header.classList.toggle('is-hidden', y > 500 && y > lastY + 4);
				if (y < lastY - 4) header.classList.remove('is-hidden');
			}
			if (pagetop) pagetop.classList.toggle('is-show', y > 600);
			lastY = y;
			ticking = false;
		}
		window.addEventListener('scroll', function () {
			if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
		}, { passive: true });
		onScroll();
		if (pagetop) {
			pagetop.addEventListener('click', function (e) {
				e.preventDefault();
				window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
			});
		}
	})();

	/* ---------- タブバー：今いるページに印 ---------- */
	(function () {
		var path = location.pathname.replace(/\/+$/, '/') || '/';
		doc.querySelectorAll('.tabbar a').forEach(function (a) {
			var p = a.pathname.replace(/\/+$/, '/') || '/';
			if (p !== '/' && path.indexOf(p) === 0) a.classList.add('is-current');
		});
	})();
})();
