// 配色の候補。共通デザインライブラリ COL-0001（AI配色の名前100選）の番号・名前・5色を元に、styles.css の --変数へ割り当てている。
export const themes = [
  { id: 'raspberry-lemon', no: '058', name: 'ラズベリーレモン', note: '甘酸っぱいピンクとレモン', colors: ['#FFF6DB', '#F4D858', '#F49DA8', '#CF4E79', '#6A3869'] },
  { id: 'nordic-lake', no: '029', name: '北欧レイク', note: '静かな湖の青と淡いピンク', colors: ['#EFF4F3', '#C8D9DB', '#88ADB8', '#527F91', '#284957'] },
  { id: 'sakura-milk', no: '001', name: '桜ミルク', note: '淡い桜色と若草', colors: ['#FFF7F5', '#F4CCD2', '#E6A6B3', '#C9D7C4', '#695B64'] },
  { id: 'pink-lemonade', no: '067', name: 'ピンクレモネード', note: '明るく軽い甘さ', colors: ['#FFF8E5', '#F9E08E', '#F7BBC4', '#EC7C9E', '#A44E78'] },
  { id: 'melon-float', no: '056', name: 'メロンフロート', note: '緑とクリーム、さくらんぼ色', colors: ['#FFF8DB', '#D7EE8C', '#8ED16C', '#46A97B', '#EF7F8F'] },
];
export const themeKey = 'entrance-counter-theme';
export const defaultTheme = themes[0].id;
export function savedTheme() {
  try { const id = localStorage.getItem(themeKey); return themes.some(t => t.id === id) ? id : defaultTheme; } catch { return defaultTheme; }
}
export function applyTheme(id) {
  const theme = themes.find(t => t.id === id) || themes[0];
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors[0]);
  return theme.id;
}
