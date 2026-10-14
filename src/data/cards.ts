/** ヤマネコの絵柄の指定。指定しない項目は、タイトル画面のヤマネコと同じになる */
export interface Look {
  fur?: string;
  light?: string;
  pink?: string;
  /** 目に色をつける (夜のヤマネコなど) */
  eyeColor?: string;
  eyes?: 'open' | 'wink' | 'sleep' | 'happy' | 'sparkle' | 'brave';
  mouth?: 'tongue' | 'smile' | 'open';
  marks?: 'stripes' | 'spots' | 'none';
  items?: Item[];
}

export type Item =
  | 'ribbon'
  | 'glasses'
  | 'pencil'
  | 'hat'
  | 'scarf'
  | 'flower'
  | 'book'
  | 'headband'
  | 'headphones'
  | 'cap'
  | 'wizard'
  | 'crown'
  | 'zzz'
  // ここから下は Reading Quest で足したもの
  | 'bookmark'
  | 'acorn'
  | 'mittens'
  | 'candle'
  | 'magnifier'
  | 'quill'
  | 'scroll'
  | 'lantern'
  | 'maple'
  | 'chestnut'
  | 'shell'
  | 'cello'
  | 'deerstalker'
  | 'hood'
  | 'mortarboard'
  | 'conductor'
  | 'beret'
  | 'laurel';

export type Background =
  | 'paper'
  | 'dots'
  | 'grid'
  | 'night'
  | 'pink'
  | 'sky'
  | 'snow'
  | 'sakura'
  | 'notes'
  | 'hanamaru'
  | 'stars'
  | 'rainbow'
  | 'gold'
  // ここから下は Reading Quest で足したもの
  | 'library'
  | 'forest'
  | 'genko'
  | 'moon'
  | 'autumn'
  | 'sea'
  | 'galaxy'
  | 'washi';

export interface Card {
  id: string;
  /** 1 年生も読めるよう、漢字は 3 年生までに習うものだけ */
  name: string;
  price: number;
  look: Look;
  bg: Background;
  frame: 'plain' | 'silver' | 'gold';
}

/**
 * Reading Quest だけのカード。物語や読書にちなんだヤマネコ。値段の安い順。
 * 値段は Wordlynx と同じならびで、合計は 28,420pt (tests/rewards.test.ts で確かめている)。
 * - 今日のチャレンジを毎日する人は、はじめの 5 枚を 2 週間以内に手に入れられる
 * - そのあとは、1 枚ごとに少しずつ時間がかかる
 * 名前は 1 年生も読めるよう、漢字は 3 年生までに習うものだけにする。
 */
export const CARDS: Card[] = [
  { id: 'rq01', name: 'しおりの ヤマネコ', price: 40, look: { items: ['bookmark'], mouth: 'smile' }, bg: 'paper', frame: 'plain' },
  { id: 'rq02', name: '本だなの ヤマネコ', price: 80, look: { items: ['book'], eyes: 'happy', mouth: 'smile' }, bg: 'library', frame: 'plain' },
  { id: 'rq03', name: 'どんぐりの ヤマネコ', price: 300, look: { items: ['acorn'], eyes: 'wink', fur: '#d9a55b' }, bg: 'forest', frame: 'plain' },
  { id: 'rq04', name: '手ぶくろの ヤマネコ', price: 500, look: { items: ['mittens', 'scarf'], mouth: 'open', eyes: 'happy' }, bg: 'snow', frame: 'plain' },
  { id: 'rq05', name: 'ろうそくの ヤマネコ', price: 800, look: { items: ['candle'], eyes: 'sleep', mouth: 'smile', fur: '#f1cf93' }, bg: 'night', frame: 'plain' },
  { id: 'rq06', name: '虫めがねの ヤマネコ', price: 1000, look: { items: ['magnifier'], eyes: 'brave', mouth: 'smile' }, bg: 'grid', frame: 'plain' },
  { id: 'rq07', name: '羽ペンの ヤマネコ', price: 1100, look: { items: ['quill'], mouth: 'smile', eyes: 'wink' }, bg: 'genko', frame: 'plain' },
  { id: 'rq08', name: 'まきものの ヤマネコ', price: 1200, look: { items: ['scroll'], eyes: 'happy', mouth: 'open', fur: '#e3b268' }, bg: 'washi', frame: 'plain' },
  { id: 'rq09', name: 'お祭りの ヤマネコ', price: 1300, look: { items: ['lantern', 'headband'], eyes: 'happy', mouth: 'open' }, bg: 'moon', frame: 'plain' },
  { id: 'rq10', name: 'もみじの ヤマネコ', price: 1400, look: { items: ['maple'], mouth: 'smile', fur: '#dba862' }, bg: 'autumn', frame: 'plain' },
  { id: 'rq11', name: 'くりひろいの ヤマネコ', price: 1500, look: { items: ['chestnut'], eyes: 'brave', mouth: 'open', fur: '#cf8f4a', light: '#fbe9cc' }, bg: 'autumn', frame: 'silver' },
  { id: 'rq12', name: '人魚の ヤマネコ', price: 1600, look: { items: ['shell'], eyes: 'sparkle', mouth: 'smile', fur: '#9fd3d6', light: '#eefafa', pink: '#f6b6c8', marks: 'spots' }, bg: 'sea', frame: 'silver' },
  { id: 'rq13', name: 'セロひきの ヤマネコ', price: 1700, look: { items: ['cello'], eyes: 'sleep', mouth: 'smile', fur: '#c9984a' }, bg: 'notes', frame: 'silver' },
  { id: 'rq14', name: 'めいたんてい ヤマネコ', price: 1800, look: { items: ['deerstalker', 'magnifier'], eyes: 'brave', mouth: 'smile' }, bg: 'library', frame: 'silver' },
  { id: 'rq15', name: '赤ずきんの ヤマネコ', price: 1900, look: { items: ['hood'], eyes: 'open', mouth: 'smile', fur: '#f0c789' }, bg: 'forest', frame: 'silver' },
  { id: 'rq16', name: '作家の ヤマネコ', price: 2000, look: { items: ['beret', 'quill'], eyes: 'wink', mouth: 'smile', fur: '#b98d5e' }, bg: 'genko', frame: 'silver' },
  { id: 'rq17', name: 'はかせの ヤマネコ', price: 2200, look: { items: ['mortarboard', 'glasses', 'book'], mouth: 'smile' }, bg: 'washi', frame: 'gold' },
  { id: 'rq18', name: '星の 鉄道 ヤマネコ', price: 2400, look: { items: ['conductor'], eyes: 'sparkle', mouth: 'smile', fur: '#8f97c9', light: '#e8eaf8', pink: '#c6a7d8', eyeColor: '#ffd94a', marks: 'spots' }, bg: 'galaxy', frame: 'gold' },
  { id: 'rq19', name: '月夜の 読書 ヤマネコ', price: 2600, look: { items: ['book', 'lantern'], eyes: 'happy', mouth: 'smile', fur: '#e6c48a' }, bg: 'moon', frame: 'gold' },
  { id: 'rq20', name: '読書の 名人 ヤマネコ', price: 3000, look: { items: ['laurel', 'book'], eyes: 'sparkle', mouth: 'open', fur: '#f0c260' }, bg: 'gold', frame: 'gold' },
];
