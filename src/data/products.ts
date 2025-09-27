import { Product } from '@/types/shop';
import jerseyGold1 from '@/assets/jersey-gold-1.jpg';
import jerseyGold2 from '@/assets/jersey-gold-2.jpg';
import jerseyPink1 from '@/assets/jersey-pink-1.jpg';
import jerseyPink2 from '@/assets/jersey-pink-2.jpg';

import shortsGold1 from '@/assets/shorts-gold-1.jpg';
import shortsGold2 from '@/assets/shorts-gold-2.jpg';
import shortsPink1 from '@/assets/shorts-pink-1.jpg';
import shortsPink2 from '@/assets/shorts-pink-2.jpg';

export const products: Product[] = [
  {
    id: '1',
    name: 'Cuore Silver Race Jersey',
    price: 98.00,
    category: 'men',
    image: jerseyGold1,
    colors: [
      { 
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2] // Multiple images for yellow
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2] // Multiple images for pink
      }
    ],
    sizes: [
      { name: 'XS', stock: 1 },
      { name: 'S', stock: 2 },
      { name: 'M', stock: 1 },
      { name: 'L', stock: 2 },
      { name: 'XL', stock: 0 }
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
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2]
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2]
      }
    ],
    sizes: [
      { name: 'XS', stock: 2 },
      { name: 'S', stock: 1 },
      { name: 'M', stock: 3 },
      { name: 'L', stock: 1 },
      { name: 'XL', stock: 2 }
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
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2] // Multiple images for yellow
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2] // Multiple images for pink
      }
    ],
    sizes: [
      { name: 'XS', stock: 1 },
      { name: 'S', stock: 2 },
      { name: 'M', stock: 1 },
      { name: 'L', stock: 2 },
      { name: 'XL', stock: 0 }
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
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2]
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2]
      }
    ],
    sizes: [
      { name: 'XS', stock: 2 },
      { name: 'S', stock: 1 },
      { name: 'M', stock: 3 },
      { name: 'L', stock: 1 },
      { name: 'XL', stock: 2 }
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
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2] // Multiple images for yellow
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2] // Multiple images for pink
      }
    ],
    sizes: [
      { name: 'XS', stock: 1 },
      { name: 'S', stock: 2 },
      { name: 'M', stock: 1 },
      { name: 'L', stock: 2 },
      { name: 'XL', stock: 0 }
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
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2]
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2]
      }
    ],
    sizes: [
      { name: 'XS', stock: 2 },
      { name: 'S', stock: 1 },
      { name: 'M', stock: 3 },
      { name: 'L', stock: 1 },
      { name: 'XL', stock: 2 }
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
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jerseyGold1, jerseyGold2] // Multiple images for yellow
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jerseyPink1, jerseyPink2] // Multiple images for pink
      }
    ],
    sizes: [
      { name: 'XS', stock: 1 },
      { name: 'S', stock: 2 },
      { name: 'M', stock: 1 },
      { name: 'L', stock: 2 },
      { name: 'XL', stock: 0 }
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
        name: 'Yellow', 
        code: '#FFFF00',
        images: [shortsGold1, shortsGold2]
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [shortsPink1, shortsPink2]
      }
    ],
    sizes: [
      { name: 'XS', stock: 2 },
      { name: 'S', stock: 1 },
      { name: 'M', stock: 3 },
      { name: 'L', stock: 1 },
      { name: 'XL', stock: 2 }
    ]
  },
];