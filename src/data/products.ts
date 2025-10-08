import { Product } from '@/types/shop';
import jerseyGold1 from '@/assets/jersey-gold-1.jpg';
import jerseyGold2 from '@/assets/jersey-gold-2.jpg';
import jerseyPink1 from '@/assets/jersey-pink-1.jpg';
import jerseyPink2 from '@/assets/jersey-pink-2.jpg';

import shortsGold1 from '@/assets/shorts-gold-1.jpg';
import shortsGold2 from '@/assets/shorts-gold-2.jpg';
import shortsPink1 from '@/assets/shorts-pink-1.jpg';
import shortsPink2 from '@/assets/shorts-pink-2.jpg';

const sizes = [
  { name: 'XS', stock: 1 },
  { name: 'S', stock: 2 },
  { name: 'M', stock: 1 },
  { name: 'L', stock: 2 },
  { name: 'XL', stock: 0 }
];

const shortsSizes = [
  { name: 'XS', stock: 2 },
  { name: 'S', stock: 1 },
  { name: 'M', stock: 3 },
  { name: 'L', stock: 1 },
  { name: 'XL', stock: 2 }
];

export const products: Product[] = [
  {
    id: '1',
    name: 'Cuore Silver Race Jersey',
    price: 98.00,
    category: 'men',
    image: jerseyGold1,
    colors: [
      { 
        id: '1-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2],
        sizes: [...sizes]
      },
      { 
        id: '1-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2],
        sizes: [...sizes]
      }
    ]
  },
  {
    id: '2',
    name: 'Cuore MTB All Mountain Shell Short',
    price: 98.00,
    category: 'men',
    image: shortsGold1,
    colors: [
      { 
        id: '2-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2],
        sizes: [...shortsSizes]
      },
      { 
        id: '2-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2],
        sizes: [...shortsSizes]
      }
    ]
  },
  {
    id: '3',
    name: 'Cuore Silver Race Jersey',
    price: 98.00,
    category: 'women',
    image: jerseyGold1,
    colors: [
      { 
        id: '3-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2],
        sizes: [...sizes]
      },
      { 
        id: '3-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2],
        sizes: [...sizes]
      }
    ]
  },
  {
    id: '4',
    name: 'Cuore MTB All Mountain Shell Short',
    price: 98.00,
    category: 'women',
    image: shortsGold1,
    colors: [
      { 
        id: '4-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2],
        sizes: [...shortsSizes]
      },
      { 
        id: '4-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2],
        sizes: [...shortsSizes]
      }
    ]
  },
  {
    id: '5',
    name: 'Cuore Silver Race Jersey',
    price: 98.00,
    category: 'kids',
    image: jerseyGold1,
    colors: [
      { 
        id: '5-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2],
        sizes: [...sizes]
      },
      { 
        id: '5-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2],
        sizes: [...sizes]
      }
    ]
  },
  {
    id: '6',
    name: 'Cuore MTB All Mountain Shell Short',
    price: 98.00,
    category: 'kids',
    image: shortsGold1,
    colors: [
      { 
        id: '6-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2],
        sizes: [...shortsSizes]
      },
      { 
        id: '6-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2],
        sizes: [...shortsSizes]
      }
    ]
  },
  {
    id: '7',
    name: 'Cuore Silver Race Jersey',
    price: 98.00,
    category: 'others',
    image: jerseyGold1,
    colors: [
      { 
        id: '7-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2],
        sizes: [...sizes]
      },
      { 
        id: '7-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2],
        sizes: [...sizes]
      }
    ]
  },
  {
    id: '8',
    name: 'Cuore MTB All Mountain Shell Short',
    price: 98.00,
    category: 'others',
    image: shortsGold1,
    colors: [
      { 
        id: '8-yellow',
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2],
        sizes: [...shortsSizes]
      },
      { 
        id: '8-pink',
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2],
        sizes: [...shortsSizes]
      }
    ]
  },
];