import { SectionId } from './types';

// 큐레이션 샘플 갤러리 매니페스트 (v7.0-r4)
// scripts/build-curated-manifest.mjs가 생성 — 사진 교체·삭제는 이 파일을 직접 편집.
// Unsplash 가이드라인: CDN 핫링크(재호스팅 금지), 선택 시 /api/unsplash?download= 핑, 어트리뷰션 표기.
export interface CuratedPhoto {
  id: string;
  thumb: string;
  regular: string;
  alt: string;
  author: string;
  authorLink: string;
  downloadLocation: string;
}

export interface CuratedCategory {
  id: string;
  label: string;
  /** 이 카테고리를 기본 선택으로 쓰는 섹션 */
  sectionIds: SectionId[];
  photos: CuratedPhoto[];
}

export const CURATED_CATEGORIES: CuratedCategory[] = [
  {
    "id": "workout",
    "label": "운동·건강",
    "sectionIds": [
      2
    ],
    "photos": [
      {
        "id": "mNGaaLeWEp0",
        "thumb": "https://images.unsplash.com/photo-1477332552946-cfb384aeaf1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1477332552946-cfb384aeaf1c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "woman walking on pathway during daytime",
        "author": "Emma Simpson",
        "authorLink": "https://unsplash.com/@esdesignisms",
        "downloadLocation": "https://api.unsplash.com/photos/mNGaaLeWEp0/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "z4WH11FMfIQ",
        "thumb": "https://images.unsplash.com/flagged/photo-1556746834-cbb4a38ee593?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/flagged/photo-1556746834-cbb4a38ee593?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "man in yellow tank top running near shore",
        "author": "Chander R",
        "authorLink": "https://unsplash.com/@chanderr",
        "downloadLocation": "https://api.unsplash.com/photos/z4WH11FMfIQ/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "oGv9xIl7DkY",
        "thumb": "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "silhouette of three women running on grey concrete road",
        "author": "Fitsum Admasu",
        "authorLink": "https://unsplash.com/@fitmasu",
        "downloadLocation": "https://api.unsplash.com/photos/oGv9xIl7DkY/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "I1EWTM5mFEM",
        "thumb": "https://images.unsplash.com/photo-1594882645126-14020914d58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1594882645126-14020914d58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "silhouette of man jumping on rocky mountain during sunset",
        "author": "Venti Views",
        "authorLink": "https://unsplash.com/@ventiviews",
        "downloadLocation": "https://api.unsplash.com/photos/I1EWTM5mFEM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "AtfA8NDgpKA",
        "thumb": "https://images.unsplash.com/flagged/photo-1556746834-1cb5b8fabd54?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/flagged/photo-1556746834-1cb5b8fabd54?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "man running near sea during daytime",
        "author": "Chander R",
        "authorLink": "https://unsplash.com/@chanderr",
        "downloadLocation": "https://api.unsplash.com/photos/AtfA8NDgpKA/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "V62UrdknDCA",
        "thumb": "https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "two men running at park",
        "author": "Huckster",
        "authorLink": "https://unsplash.com/@huckster",
        "downloadLocation": "https://api.unsplash.com/photos/V62UrdknDCA/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "JnoNcfFwrNA",
        "thumb": "https://images.unsplash.com/photo-1502224562085-639556652f33?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1502224562085-639556652f33?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "silhouette photo of a person running on road",
        "author": "lucas Favre",
        "authorLink": "https://unsplash.com/@we_are_rising",
        "downloadLocation": "https://api.unsplash.com/photos/JnoNcfFwrNA/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "3I2vzcmEpLU",
        "thumb": "https://images.unsplash.com/photo-1509833903111-9cb142f644e4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1509833903111-9cb142f644e4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "woman jogging near wire fence",
        "author": "Andrew Tanglao",
        "authorLink": "https://unsplash.com/@andrewtanglao",
        "downloadLocation": "https://api.unsplash.com/photos/3I2vzcmEpLU/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "a6FHROHuQ9o",
        "thumb": "https://images.unsplash.com/photo-1603455778956-d71832eafa4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1603455778956-d71832eafa4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "woman in black sports bra and black pants running on water during sunset",
        "author": "McCarthy Beckan",
        "authorLink": "https://unsplash.com/@mccarthybeckan",
        "downloadLocation": "https://api.unsplash.com/photos/a6FHROHuQ9o/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxtb3JuaW5nJTIwcnVubmluZyUyMHdvcmtvdXQlMjB3ZWxsbmVzcyUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzg3fDA"
      },
      {
        "id": "SS--7iqimwY",
        "thumb": "https://images.unsplash.com/photo-1658467914626-ae3959c9815e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8bW9ybmluZyUyMHJ1bm5pbmclMjB3b3Jrb3V0JTIwd2VsbG5lc3MlMjBsaWZlc3R5bGV8ZW58MXwwfHx8MTc4MzQxNDc4N3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1658467914626-ae3959c9815e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8bW9ybmluZyUyMHJ1bm5pbmclMjB3b3Jrb3V0JTIwd2VsbG5lc3MlMjBsaWZlc3R5bGV8ZW58MXwwfHx8MTc4MzQxNDc4N3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a person standing on a bridge",
        "author": "Shadrina Izzati",
        "authorLink": "https://unsplash.com/@shadrinaizzati",
        "downloadLocation": "https://api.unsplash.com/photos/SS--7iqimwY/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8bW9ybmluZyUyMHJ1bm5pbmclMjB3b3Jrb3V0JTIwd2VsbG5lc3MlMjBsaWZlc3R5bGV8ZW58MXwwfHx8MTc4MzQxNDc4N3ww"
      }
    ]
  },
  {
    "id": "nature",
    "label": "자연·휴식",
    "sectionIds": [
      1
    ],
    "photos": [
      {
        "id": "jlVEj8IDPQc",
        "thumb": "https://images.unsplash.com/photo-1528184039930-bd03972bd974?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1528184039930-bd03972bd974?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "river beside trees and grass field",
        "author": "Simon Wilkes",
        "authorLink": "https://unsplash.com/@simonfromengland",
        "downloadLocation": "https://api.unsplash.com/photos/jlVEj8IDPQc/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "j3CjZYckM88",
        "thumb": "https://images.unsplash.com/photo-1533757879476-8f4a3cb1ae4b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1533757879476-8f4a3cb1ae4b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "wide lake over sunset view",
        "author": "Emma Harper",
        "authorLink": "https://unsplash.com/@emarieharp015",
        "downloadLocation": "https://api.unsplash.com/photos/j3CjZYckM88/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "8AwXs7GKzCk",
        "thumb": "https://images.unsplash.com/photo-1568961248350-742799cdc67a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1568961248350-742799cdc67a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "green leafed trees",
        "author": "Mario Dobelmann",
        "authorLink": "https://unsplash.com/@mariodobelmann",
        "downloadLocation": "https://api.unsplash.com/photos/8AwXs7GKzCk/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "kGP5UqV6Mss",
        "thumb": "https://images.unsplash.com/photo-1628826821015-6df48acb4aa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1628826821015-6df48acb4aa4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "green trees beside river during daytime",
        "author": "Syuhei Inoue",
        "authorLink": "https://unsplash.com/@_______life_",
        "downloadLocation": "https://api.unsplash.com/photos/kGP5UqV6Mss/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "QnrlYBZ71TA",
        "thumb": "https://images.unsplash.com/photo-1741578414826-15feae607817?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1741578414826-15feae607817?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Trees arch over a calm, reflective river.",
        "author": "Siddhay D",
        "authorLink": "https://unsplash.com/@siddhay",
        "downloadLocation": "https://api.unsplash.com/photos/QnrlYBZ71TA/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "pm6rsRZh3Y0",
        "thumb": "https://images.unsplash.com/photo-1759596436849-33b6e33e8ea4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1759596436849-33b6e33e8ea4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Golden sunlight filters through tall grass at dawn.",
        "author": "Yogesh Pedamkar",
        "authorLink": "https://unsplash.com/@yogesh_7",
        "downloadLocation": "https://api.unsplash.com/photos/pm6rsRZh3Y0/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "ir0gOtkzkUk",
        "thumb": "https://images.unsplash.com/photo-1780499213028-3931f513e5c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1780499213028-3931f513e5c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Golden sunset over a calm river with a bridge railing.",
        "author": "Aayushi Tyagi",
        "authorLink": "https://unsplash.com/@aeternusvita13",
        "downloadLocation": "https://api.unsplash.com/photos/ir0gOtkzkUk/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "01k-C0uY_0Y",
        "thumb": "https://images.unsplash.com/photo-1776806399638-3f6693f8dcd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1776806399638-3f6693f8dcd4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Sunrise over a misty meadow with tall grass.",
        "author": "Aleksei Agafonov",
        "authorLink": "https://unsplash.com/@alekseixagafonov",
        "downloadLocation": "https://api.unsplash.com/photos/01k-C0uY_0Y/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "l0uMrskXaxM",
        "thumb": "https://images.unsplash.com/photo-1759642796512-55f86af74502?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1759642796512-55f86af74502?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Golden sun setting behind silhouetted plants",
        "author": "Kevin Doyle",
        "authorLink": "https://unsplash.com/@kevdoy",
        "downloadLocation": "https://api.unsplash.com/photos/l0uMrskXaxM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjYWxtJTIwbmF0dXJlJTIwbW9ybmluZyUyMGxpZ2h0JTIwcGVhY2VmdWx8ZW58MXwwfHx8MTc4MzQxNDc4OHww"
      },
      {
        "id": "LBDxDdVBLl8",
        "thumb": "https://images.unsplash.com/photo-1771527190480-d1e8a704ee9f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y2FsbSUyMG5hdHVyZSUyMG1vcm5pbmclMjBsaWdodCUyMHBlYWNlZnVsfGVufDF8MHx8fDE3ODM0MTQ3ODh8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1771527190480-d1e8a704ee9f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y2FsbSUyMG5hdHVyZSUyMG1vcm5pbmclMjBsaWdodCUyMHBlYWNlZnVsfGVufDF8MHx8fDE3ODM0MTQ3ODh8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Sun setting behind silhouetted branches and dry grass",
        "author": "Mohamed B.",
        "authorLink": "https://unsplash.com/@bangscreative",
        "downloadLocation": "https://api.unsplash.com/photos/LBDxDdVBLl8/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y2FsbSUyMG5hdHVyZSUyMG1vcm5pbmclMjBsaWdodCUyMHBlYWNlZnVsfGVufDF8MHx8fDE3ODM0MTQ3ODh8MA"
      }
    ]
  },
  {
    "id": "relationship",
    "label": "관계",
    "sectionIds": [
      3
    ],
    "photos": [
      {
        "id": "cfGG0niafjc",
        "thumb": "https://images.unsplash.com/photo-1578496780896-7081cc23c111?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1578496780896-7081cc23c111?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "group of person eating indoors",
        "author": "National Cancer Institute",
        "authorLink": "https://unsplash.com/@nci",
        "downloadLocation": "https://api.unsplash.com/photos/cfGG0niafjc/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "Jwuv9ngb3UE",
        "thumb": "https://images.unsplash.com/photo-1539056276907-dc946d5098c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1539056276907-dc946d5098c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a group of people eating in a restaurant",
        "author": "Zach Reiner",
        "authorLink": "https://unsplash.com/@_zachreiner_",
        "downloadLocation": "https://api.unsplash.com/photos/Jwuv9ngb3UE/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "4aM_QE-HRLw",
        "thumb": "https://images.unsplash.com/photo-1578515637272-e4afe0b8ec82?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1578515637272-e4afe0b8ec82?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a couple of people holding a bowl of food",
        "author": "Dan DeAlmeida",
        "authorLink": "https://unsplash.com/@ddealmeida",
        "downloadLocation": "https://api.unsplash.com/photos/4aM_QE-HRLw/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "zbI9maUvcaM",
        "thumb": "https://images.unsplash.com/photo-1683537277115-502a6eecb6ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1683537277115-502a6eecb6ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a group of people sitting around a wooden table",
        "author": "Sweet Life",
        "authorLink": "https://unsplash.com/@sweetlifediabetes",
        "downloadLocation": "https://api.unsplash.com/photos/zbI9maUvcaM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "OssO-J9eNyI",
        "thumb": "https://images.unsplash.com/photo-1686489356516-a54af456d168?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1686489356516-a54af456d168?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a group of people sitting around a dinner table",
        "author": "Annie Spratt",
        "authorLink": "https://unsplash.com/@anniespratt",
        "downloadLocation": "https://api.unsplash.com/photos/OssO-J9eNyI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "4q44RjJkeuM",
        "thumb": "https://images.unsplash.com/photo-1683541606184-fecb068b26eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1683541606184-fecb068b26eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a group of people sitting around a wooden table",
        "author": "Sweet Life",
        "authorLink": "https://unsplash.com/@sweetlifediabetes",
        "downloadLocation": "https://api.unsplash.com/photos/4q44RjJkeuM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "UEjjO-aJtZ8",
        "thumb": "https://images.unsplash.com/photo-1778694277039-5cbf0b9a1fcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1778694277039-5cbf0b9a1fcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "People enjoying a candlelit dinner at a dimly lit restaurant.",
        "author": "Romain Gal",
        "authorLink": "https://unsplash.com/@wamstudio",
        "downloadLocation": "https://api.unsplash.com/photos/UEjjO-aJtZ8/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "11kwLZSdCHc",
        "thumb": "https://images.unsplash.com/photo-1641106598744-7ab007994063?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1641106598744-7ab007994063?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a group of women sitting around a table eating food",
        "author": "November Wong",
        "authorLink": "https://unsplash.com/@novemberwong",
        "downloadLocation": "https://api.unsplash.com/photos/11kwLZSdCHc/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "qSwKivdr37M",
        "thumb": "https://images.unsplash.com/photo-1635210793729-a535627a41b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1635210793729-a535627a41b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a group of people sitting around a table",
        "author": "Kan Denis",
        "authorLink": "https://unsplash.com/@patt____k",
        "downloadLocation": "https://api.unsplash.com/photos/qSwKivdr37M/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxmcmllbmRzJTIwZmFtaWx5JTIwd2FybSUyMGRpbm5lciUyMHRvZ2V0aGVyfGVufDF8MHx8fDE3ODM0MTQ3ODl8MA"
      },
      {
        "id": "AtGqSiqEJCA",
        "thumb": "https://images.unsplash.com/photo-1683538185904-4dc847308479?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8ZnJpZW5kcyUyMGZhbWlseSUyMHdhcm0lMjBkaW5uZXIlMjB0b2dldGhlcnxlbnwxfDB8fHwxNzgzNDE0Nzg5fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1683538185904-4dc847308479?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8ZnJpZW5kcyUyMGZhbWlseSUyMHdhcm0lMjBkaW5uZXIlMjB0b2dldGhlcnxlbnwxfDB8fHwxNzgzNDE0Nzg5fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a group of people sitting around a table eating food",
        "author": "Sweet Life",
        "authorLink": "https://unsplash.com/@sweetlifediabetes",
        "downloadLocation": "https://api.unsplash.com/photos/AtGqSiqEJCA/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8ZnJpZW5kcyUyMGZhbWlseSUyMHdhcm0lMjBkaW5uZXIlMjB0b2dldGhlcnxlbnwxfDB8fHwxNzgzNDE0Nzg5fDA"
      }
    ]
  },
  {
    "id": "work",
    "label": "일·성장",
    "sectionIds": [
      4
    ],
    "photos": [
      {
        "id": "TM6GooYY1pc",
        "thumb": "https://images.unsplash.com/photo-1774853114355-1ac941f85397?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1774853114355-1ac941f85397?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Modern office with desk, chair, and teal couch.",
        "author": "FlippingBook",
        "authorLink": "https://unsplash.com/@flippingbook",
        "downloadLocation": "https://api.unsplash.com/photos/TM6GooYY1pc/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "ay1vG2t-hPQ",
        "thumb": "https://images.unsplash.com/photo-1767126600705-b40408eabd3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1767126600705-b40408eabd3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Computer workstation with multiple monitors and plants.",
        "author": "Jefferson Sees",
        "authorLink": "https://unsplash.com/@jeffersonsees",
        "downloadLocation": "https://api.unsplash.com/photos/ay1vG2t-hPQ/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "jZQO3inAPe4",
        "thumb": "https://images.unsplash.com/photo-1765758014805-a7a6cc272982?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1765758014805-a7a6cc272982?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A cluttered desk with a computer and artwork.",
        "author": "Orlando García",
        "authorLink": "https://unsplash.com/@orlandogp",
        "downloadLocation": "https://api.unsplash.com/photos/jZQO3inAPe4/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "xKjFbpDj2sA",
        "thumb": "https://images.unsplash.com/photo-1769199242673-d0857146e1ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1769199242673-d0857146e1ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Desk with laptop, monitor, and guitar",
        "author": "Jose Zuniga",
        "authorLink": "https://unsplash.com/@jramiroz98",
        "downloadLocation": "https://api.unsplash.com/photos/xKjFbpDj2sA/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "bnCNT9DEuRM",
        "thumb": "https://images.unsplash.com/photo-1763833294545-e38e4fab1961?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1763833294545-e38e4fab1961?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A desk with computers, fan, and storage shelves.",
        "author": "Annie Spratt",
        "authorLink": "https://unsplash.com/@anniespratt",
        "downloadLocation": "https://api.unsplash.com/photos/bnCNT9DEuRM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "OjmhUpWfXyg",
        "thumb": "https://images.unsplash.com/photo-1758718036788-de50f9fd2192?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1758718036788-de50f9fd2192?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Wall art and a black desk lamp in a room.",
        "author": "Annie Spratt",
        "authorLink": "https://unsplash.com/@anniespratt",
        "downloadLocation": "https://api.unsplash.com/photos/OjmhUpWfXyg/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "UTRtBYRVwaY",
        "thumb": "https://images.unsplash.com/photo-1760348213488-a49b72148e48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1760348213488-a49b72148e48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A computer desk with monitor, keyboard, and sunflower.",
        "author": "Bedirhan Gül",
        "authorLink": "https://unsplash.com/@bedirhann",
        "downloadLocation": "https://api.unsplash.com/photos/UTRtBYRVwaY/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "M2xI-GIy-gI",
        "thumb": "https://images.unsplash.com/photo-1779949294758-f2728920623c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1779949294758-f2728920623c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Creative workspace with computer, speakers, microphone, and framed art.",
        "author": "Orlando García",
        "authorLink": "https://unsplash.com/@orlandogp",
        "downloadLocation": "https://api.unsplash.com/photos/M2xI-GIy-gI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "V18LCaKa0LI",
        "thumb": "https://images.unsplash.com/photo-1758383965264-b871a14bfff5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1758383965264-b871a14bfff5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A cluttered desk in a room with a large window.",
        "author": "Bundo Kim",
        "authorLink": "https://unsplash.com/@bundo",
        "downloadLocation": "https://api.unsplash.com/photos/V18LCaKa0LI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxmb2N1c2VkJTIwd29yayUyMGNyZWF0aXZlJTIwc3R1ZGlvJTIwZGVza3xlbnwxfDB8fHwxNzgzNDE0NzkwfDA"
      },
      {
        "id": "ACiA74TQjnQ",
        "thumb": "https://images.unsplash.com/photo-1780570751649-6867a5f49139?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Zm9jdXNlZCUyMHdvcmslMjBjcmVhdGl2ZSUyMHN0dWRpbyUyMGRlc2t8ZW58MXwwfHx8MTc4MzQxNDc5MHww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1780570751649-6867a5f49139?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Zm9jdXNlZCUyMHdvcmslMjBjcmVhdGl2ZSUyMHN0dWRpbyUyMGRlc2t8ZW58MXwwfHx8MTc4MzQxNDc5MHww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A person working on a computer with studio monitors.",
        "author": "Grace Anne Bobadilla",
        "authorLink": "https://unsplash.com/@graceannefully",
        "downloadLocation": "https://api.unsplash.com/photos/ACiA74TQjnQ/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Zm9jdXNlZCUyMHdvcmslMjBjcmVhdGl2ZSUyMHN0dWRpbyUyMGRlc2t8ZW58MXwwfHx8MTc4MzQxNDc5MHww"
      }
    ]
  },
  {
    "id": "travel",
    "label": "여행·자유",
    "sectionIds": [
      5
    ],
    "photos": [
      {
        "id": "cZYDcIlNCnE",
        "thumb": "https://images.unsplash.com/photo-1776142519083-9d707f342890?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1776142519083-9d707f342890?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Camper van parked by the ocean with a person",
        "author": "Fabio Sasso",
        "authorLink": "https://unsplash.com/@abduzeedo",
        "downloadLocation": "https://api.unsplash.com/photos/cZYDcIlNCnE/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "oZp25y9B3rI",
        "thumb": "https://images.unsplash.com/photo-1765053404213-f91919e71638?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1765053404213-f91919e71638?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Two birds fly over a lake and mountains.",
        "author": "Sára Sedlmajerová",
        "authorLink": "https://unsplash.com/@sari211",
        "downloadLocation": "https://api.unsplash.com/photos/oZp25y9B3rI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "ZypRn5gDHmI",
        "thumb": "https://images.unsplash.com/photo-1780539404775-b58e86edfc19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1780539404775-b58e86edfc19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "An empty road winds towards mountains under a gray sky.",
        "author": "Luisa Linkous",
        "authorLink": "https://unsplash.com/@luisalinkous",
        "downloadLocation": "https://api.unsplash.com/photos/ZypRn5gDHmI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "Asp8RD9Pqyw",
        "thumb": "https://images.unsplash.com/photo-1778461456542-b4325a1609f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1778461456542-b4325a1609f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A scenic coastal highway with lush green hills.",
        "author": "Devin Avery",
        "authorLink": "https://unsplash.com/@devintavery",
        "downloadLocation": "https://api.unsplash.com/photos/Asp8RD9Pqyw/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "5uBxehjrfJ0",
        "thumb": "https://images.unsplash.com/photo-1771271290948-2b6f3048a1f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1771271290948-2b6f3048a1f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Long empty road through dry grassy landscape",
        "author": "Patrick Zeef",
        "authorLink": "https://unsplash.com/@pzeef",
        "downloadLocation": "https://api.unsplash.com/photos/5uBxehjrfJ0/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "0I6GeUxnRbw",
        "thumb": "https://images.unsplash.com/photo-1765871320629-d7b6ebf6f76d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1765871320629-d7b6ebf6f76d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Open highway stretching towards distant mountains under a cloudy sky",
        "author": "Roberto Shumski",
        "authorLink": "https://unsplash.com/@robshumski",
        "downloadLocation": "https://api.unsplash.com/photos/0I6GeUxnRbw/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "ghZlDMUcJ-8",
        "thumb": "https://images.unsplash.com/photo-1764092861433-09218f2d63f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1764092861433-09218f2d63f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Empty desert highway leading to distant mountains.",
        "author": "Austin Ramsey",
        "authorLink": "https://unsplash.com/@austin__ramsey",
        "downloadLocation": "https://api.unsplash.com/photos/ghZlDMUcJ-8/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "p2H3PmGld8U",
        "thumb": "https://images.unsplash.com/photo-1773658949443-6879059308cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1773658949443-6879059308cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Person standing on rock overlooking turquoise mountain lake.",
        "author": "sayan Nath",
        "authorLink": "https://unsplash.com/@hiresayan",
        "downloadLocation": "https://api.unsplash.com/photos/p2H3PmGld8U/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "J5B8vHTGqLc",
        "thumb": "https://images.unsplash.com/photo-1743798276930-e7edae5bc390?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1743798276930-e7edae5bc390?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Sailing on the sea with mountains in the distance.",
        "author": "Kristina Tochilko",
        "authorLink": "https://unsplash.com/@tochilko",
        "downloadLocation": "https://api.unsplash.com/photos/J5B8vHTGqLc/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHx0cmF2ZWwlMjBhZHZlbnR1cmUlMjBzY2VuaWMlMjBmcmVlZG9tfGVufDF8MHx8fDE3ODM0MTQ3OTJ8MA"
      },
      {
        "id": "_9_UjukCfNM",
        "thumb": "https://images.unsplash.com/photo-1765873360327-cfa4c3ab615c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8dHJhdmVsJTIwYWR2ZW50dXJlJTIwc2NlbmljJTIwZnJlZWRvbXxlbnwxfDB8fHwxNzgzNDE0NzkyfDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1765873360327-cfa4c3ab615c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8dHJhdmVsJTIwYWR2ZW50dXJlJTIwc2NlbmljJTIwZnJlZWRvbXxlbnwxfDB8fHwxNzgzNDE0NzkyfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Open desert highway with distant mesas under a cloudy sky",
        "author": "Roberto Shumski",
        "authorLink": "https://unsplash.com/@robshumski",
        "downloadLocation": "https://api.unsplash.com/photos/_9_UjukCfNM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8dHJhdmVsJTIwYWR2ZW50dXJlJTIwc2NlbmljJTIwZnJlZWRvbXxlbnwxfDB8fHwxNzgzNDE0NzkyfDA"
      }
    ]
  },
  {
    "id": "home",
    "label": "집·공간",
    "sectionIds": [
      6
    ],
    "photos": [
      {
        "id": "Y3sSlsS9zlI",
        "thumb": "https://images.unsplash.com/photo-1626965654957-fef1cb80d4b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1626965654957-fef1cb80d4b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "blue and white sofa set",
        "author": "Kate Darmody",
        "authorLink": "https://unsplash.com/@kdarmody",
        "downloadLocation": "https://api.unsplash.com/photos/Y3sSlsS9zlI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "fgLen78-7ro",
        "thumb": "https://images.unsplash.com/photo-1657040899606-b22f17a6afd5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1657040899606-b22f17a6afd5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a living room with a couch and plants",
        "author": "Christina Radevich",
        "authorLink": "https://unsplash.com/@chris_designer",
        "downloadLocation": "https://api.unsplash.com/photos/fgLen78-7ro/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "pfC-ZuBrl2c",
        "thumb": "https://images.unsplash.com/photo-1740263700999-ffcf1b5bb94a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1740263700999-ffcf1b5bb94a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A couple of potted plants sitting on top of a shelf",
        "author": "Barbara Burgess",
        "authorLink": "https://unsplash.com/@fieldworkframes",
        "downloadLocation": "https://api.unsplash.com/photos/pfC-ZuBrl2c/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "ZLlLfPgP-W0",
        "thumb": "https://images.unsplash.com/photo-1614959541555-4550895d4b2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1614959541555-4550895d4b2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "green plants on brown clay pot",
        "author": "Annie Spratt",
        "authorLink": "https://unsplash.com/@anniespratt",
        "downloadLocation": "https://api.unsplash.com/photos/ZLlLfPgP-W0/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "9Cm9ywhOKQ4",
        "thumb": "https://images.unsplash.com/photo-1656275537622-7837184a0dcc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1656275537622-7837184a0dcc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a room with a couch and plants",
        "author": "Annie Spratt",
        "authorLink": "https://unsplash.com/@anniespratt",
        "downloadLocation": "https://api.unsplash.com/photos/9Cm9ywhOKQ4/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "WWMzKq_80CI",
        "thumb": "https://images.unsplash.com/photo-1617202074052-fa303398aa00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1617202074052-fa303398aa00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "brown wooden coffee table near gray sofa",
        "author": "Kate Darmody",
        "authorLink": "https://unsplash.com/@kdarmody",
        "downloadLocation": "https://api.unsplash.com/photos/WWMzKq_80CI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "LblAD2QhfeM",
        "thumb": "https://images.unsplash.com/photo-1675468408406-470b28bb2b81?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1675468408406-470b28bb2b81?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a white mantle with a mirror and plants on it",
        "author": "Ashe Walker",
        "authorLink": "https://unsplash.com/@marsupialpudding",
        "downloadLocation": "https://api.unsplash.com/photos/LblAD2QhfeM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "8CVcpWyb5SQ",
        "thumb": "https://images.unsplash.com/photo-1775480393048-8842b5371a76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1775480393048-8842b5371a76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Sunlight streams through lush indoor plants and cushions.",
        "author": "Seongjin Park",
        "authorLink": "https://unsplash.com/@parkseongjin",
        "downloadLocation": "https://api.unsplash.com/photos/8CVcpWyb5SQ/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "90opoJA2DBQ",
        "thumb": "https://images.unsplash.com/photo-1760552267060-7185dd08537b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1760552267060-7185dd08537b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Sunlight streams into a room overlooking trees.",
        "author": "fr0ggy5",
        "authorLink": "https://unsplash.com/@fr0ggy5_",
        "downloadLocation": "https://api.unsplash.com/photos/90opoJA2DBQ/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjb3p5JTIwaG9tZSUyMGludGVyaW9yJTIwc3VubGlnaHQlMjBwbGFudHN8ZW58MXwwfHx8MTc4MzQxNDc5M3ww"
      },
      {
        "id": "W83HRDSkaL4",
        "thumb": "https://images.unsplash.com/photo-1745816384569-28163a18b4fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y296eSUyMGhvbWUlMjBpbnRlcmlvciUyMHN1bmxpZ2h0JTIwcGxhbnRzfGVufDF8MHx8fDE3ODM0MTQ3OTN8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1745816384569-28163a18b4fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y296eSUyMGhvbWUlMjBpbnRlcmlvciUyMHN1bmxpZ2h0JTIwcGxhbnRzfGVufDF8MHx8fDE3ODM0MTQ3OTN8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Sun-drenched porch overflowing with lush, green plants.",
        "author": "Brett Wharton",
        "authorLink": "https://unsplash.com/@brettwharton",
        "downloadLocation": "https://api.unsplash.com/photos/W83HRDSkaL4/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y296eSUyMGhvbWUlMjBpbnRlcmlvciUyMHN1bmxpZ2h0JTIwcGxhbnRzfGVufDF8MHx8fDE3ODM0MTQ3OTN8MA"
      }
    ]
  },
  {
    "id": "daily",
    "label": "음식·일상",
    "sectionIds": [],
    "photos": [
      {
        "id": "pgVvMfsv8EM",
        "thumb": "https://images.unsplash.com/photo-1454916286212-0ea211dc68d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1454916286212-0ea211dc68d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "green and white mug",
        "author": "Julian Hochgesang",
        "authorLink": "https://unsplash.com/@julianhochgesang",
        "downloadLocation": "https://api.unsplash.com/photos/pgVvMfsv8EM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "C8C020JnsjM",
        "thumb": "https://images.unsplash.com/photo-1525169507283-1a58b0ccc082?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1525169507283-1a58b0ccc082?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "white mug beside white paper",
        "author": "Annie Spratt",
        "authorLink": "https://unsplash.com/@anniespratt",
        "downloadLocation": "https://api.unsplash.com/photos/C8C020JnsjM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "MVXMDFL9YVA",
        "thumb": "https://images.unsplash.com/photo-1663911261983-fdec90adb549?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1663911261983-fdec90adb549?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a vase with flowers and a cup of coffee on a table",
        "author": "Carmen Genade",
        "authorLink": "https://unsplash.com/@ceylontealeaf",
        "downloadLocation": "https://api.unsplash.com/photos/MVXMDFL9YVA/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "gBqxWOToEs0",
        "thumb": "https://images.unsplash.com/photo-1638871545463-67e02e28623d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1638871545463-67e02e28623d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a tray with a croissant and a cup of coffee on it",
        "author": "Eryk Piotr Munk",
        "authorLink": "https://unsplash.com/@piotrmunk",
        "downloadLocation": "https://api.unsplash.com/photos/gBqxWOToEs0/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "WOzjoDzdoU4",
        "thumb": "https://images.unsplash.com/photo-1767220003074-1e017aa7a607?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1767220003074-1e017aa7a607?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A breakfast sandwich with coffee and a book.",
        "author": "CARMELA LUSTRE",
        "authorLink": "https://unsplash.com/@carmelalustrephotography",
        "downloadLocation": "https://api.unsplash.com/photos/WOzjoDzdoU4/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "nhfrBwrL0dY",
        "thumb": "https://images.unsplash.com/photo-1781460903505-c82fe437be4b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1781460903505-c82fe437be4b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "A steaming mug of hot beverage on a wooden table.",
        "author": "Barney Goodman",
        "authorLink": "https://unsplash.com/@bgoodpic",
        "downloadLocation": "https://api.unsplash.com/photos/nhfrBwrL0dY/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "DYBQlhPeSu8",
        "thumb": "https://images.unsplash.com/photo-1767220003707-6287f3cb41db?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1767220003707-6287f3cb41db?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Jesus calling book with breakfast and candle",
        "author": "CARMELA LUSTRE",
        "authorLink": "https://unsplash.com/@carmelalustrephotography",
        "downloadLocation": "https://api.unsplash.com/photos/DYBQlhPeSu8/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "0lKTASWm_UQ",
        "thumb": "https://images.unsplash.com/photo-1758522490286-31bf5af96d4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1758522490286-31bf5af96d4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Couple enjoying coffee together by the window",
        "author": "Vitaly Gariev",
        "authorLink": "https://unsplash.com/@silverkblack",
        "downloadLocation": "https://api.unsplash.com/photos/0lKTASWm_UQ/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "3rXZyQdMdlI",
        "thumb": "https://images.unsplash.com/photo-1758522490273-83abd2c9c3d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1758522490273-83abd2c9c3d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Couple looking at a smartphone together",
        "author": "Vitaly Gariev",
        "authorLink": "https://unsplash.com/@silverkblack",
        "downloadLocation": "https://api.unsplash.com/photos/3rXZyQdMdlI/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxjb2ZmZWUlMjBicmVha2Zhc3QlMjBjb3p5JTIwZGFpbHklMjBsaWZlfGVufDF8MHx8fDE3ODM0MTQ3OTR8MA"
      },
      {
        "id": "nHe8OAVrc34",
        "thumb": "https://images.unsplash.com/photo-1758523417185-5d46089b870a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y29mZmVlJTIwYnJlYWtmYXN0JTIwY296eSUyMGRhaWx5JTIwbGlmZXxlbnwxfDB8fHwxNzgzNDE0Nzk0fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1758523417185-5d46089b870a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y29mZmVlJTIwYnJlYWtmYXN0JTIwY296eSUyMGRhaWx5JTIwbGlmZXxlbnwxfDB8fHwxNzgzNDE0Nzk0fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "Couple looking at tablet in modern kitchen",
        "author": "Vitaly Gariev",
        "authorLink": "https://unsplash.com/@silverkblack",
        "downloadLocation": "https://api.unsplash.com/photos/nHe8OAVrc34/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8Y29mZmVlJTIwYnJlYWtmYXN0JTIwY296eSUyMGRhaWx5JTIwbGlmZXxlbnwxfDB8fHwxNzgzNDE0Nzk0fDA"
      }
    ]
  },
  {
    "id": "achievement",
    "label": "성취·여유",
    "sectionIds": [],
    "photos": [
      {
        "id": "FiZTaNTj2Ak",
        "thumb": "https://images.unsplash.com/photo-1497561813398-8fcc7a37b567?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1497561813398-8fcc7a37b567?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "silhouette of man standing on high ground under red and blue skies",
        "author": "Benjamin Davies",
        "authorLink": "https://unsplash.com/@bendavisual",
        "downloadLocation": "https://api.unsplash.com/photos/FiZTaNTj2Ak/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA"
      },
      {
        "id": "E9ANYNkN4Sc",
        "thumb": "https://images.unsplash.com/photo-1503266980949-bd30d04d0b7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1503266980949-bd30d04d0b7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "person throwing confetti",
        "author": "Ambreen Hasan",
        "authorLink": "https://unsplash.com/@ambreenhasan",
        "downloadLocation": "https://api.unsplash.com/photos/E9ANYNkN4Sc/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwyfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA"
      },
      {
        "id": "zeqWK0n5PNM",
        "thumb": "https://images.unsplash.com/photo-1551845728-6820a30c64e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1551845728-6820a30c64e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "two women hands up standing beside body of water",
        "author": "Priscilla Du Preez 🇨🇦",
        "authorLink": "https://unsplash.com/@priscilladupreez",
        "downloadLocation": "https://api.unsplash.com/photos/zeqWK0n5PNM/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwzfHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA"
      },
      {
        "id": "JWAAgQSbq44",
        "thumb": "https://images.unsplash.com/photo-1564341505027-b410c159e1b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1564341505027-b410c159e1b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a person jumping in the air at sunset",
        "author": "Marc Najera",
        "authorLink": "https://unsplash.com/@marcnajera",
        "downloadLocation": "https://api.unsplash.com/photos/JWAAgQSbq44/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw0fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA"
      },
      {
        "id": "x5nZzttn2_k",
        "thumb": "https://images.unsplash.com/photo-1548126466-4470dfd3a209?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1548126466-4470dfd3a209?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "person raising hands",
        "author": "Eunice De Guzman",
        "authorLink": "https://unsplash.com/@edg0308",
        "downloadLocation": "https://api.unsplash.com/photos/x5nZzttn2_k/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw1fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA"
      },
      {
        "id": "Ls3yexjyRpk",
        "thumb": "https://images.unsplash.com/photo-1501743411739-de52ea0ce6a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1501743411739-de52ea0ce6a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "man reaching hands up high taken at daytime",
        "author": "Japheth Mast",
        "authorLink": "https://unsplash.com/@japhethmast",
        "downloadLocation": "https://api.unsplash.com/photos/Ls3yexjyRpk/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw2fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTV8MA"
      },
      {
        "id": "mWxfBPiUYQ0",
        "thumb": "https://images.unsplash.com/photo-1632766814518-09285fcc69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1632766814518-09285fcc69c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "a person jumping in the air with their arms in the air",
        "author": "Ines Azevedo",
        "authorLink": "https://unsplash.com/@ines_az",
        "downloadLocation": "https://api.unsplash.com/photos/mWxfBPiUYQ0/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw3fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA"
      },
      {
        "id": "FNqNEbDmYmE",
        "thumb": "https://images.unsplash.com/photo-1560285843-9d9d94edff8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1560285843-9d9d94edff8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "man in white t-shirt and grey pants standing on top of hill",
        "author": "Catalin Pop",
        "authorLink": "https://unsplash.com/@catalinpop",
        "downloadLocation": "https://api.unsplash.com/photos/FNqNEbDmYmE/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw4fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA"
      },
      {
        "id": "Ts7CLyeik54",
        "thumb": "https://images.unsplash.com/photo-1598635813981-d9aac34150ce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1598635813981-d9aac34150ce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "people walking on beach during sunset",
        "author": "Gabe Pierce",
        "authorLink": "https://unsplash.com/@gaberce",
        "downloadLocation": "https://api.unsplash.com/photos/Ts7CLyeik54/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHw5fHxzdWNjZXNzJTIwY2VsZWJyYXRpb24lMjByZWxheGVkJTIwbGlmZXN0eWxlfGVufDF8MHx8fDE3ODM0MTQ3OTZ8MA"
      },
      {
        "id": "Ytcwrc6GgAE",
        "thumb": "https://images.unsplash.com/photo-1573269354259-8c108692afa1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8c3VjY2VzcyUyMGNlbGVicmF0aW9uJTIwcmVsYXhlZCUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzk2fDA&ixlib=rb-4.1.0&q=80&w=400",
        "regular": "https://images.unsplash.com/photo-1573269354259-8c108692afa1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8c3VjY2VzcyUyMGNlbGVicmF0aW9uJTIwcmVsYXhlZCUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzk2fDA&ixlib=rb-4.1.0&q=80&w=1080",
        "alt": "time lapse photography of group of people jumping on seashore under golden hour",
        "author": "Daniel Joshua",
        "authorLink": "https://unsplash.com/@daniel_joshua_",
        "downloadLocation": "https://api.unsplash.com/photos/Ytcwrc6GgAE/download?ixid=M3w5NzU0NDl8MHwxfHNlYXJjaHwxMHx8c3VjY2VzcyUyMGNlbGVicmF0aW9uJTIwcmVsYXhlZCUyMGxpZmVzdHlsZXxlbnwxfDB8fHwxNzgzNDE0Nzk2fDA"
      }
    ]
  }
];

export function defaultCategoryFor(sectionId: SectionId): CuratedCategory {
  return (
    CURATED_CATEGORIES.find((c) => c.sectionIds.includes(sectionId)) ?? CURATED_CATEGORIES[0]
  );
}
