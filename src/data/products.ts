import { Product } from '@/types/shop';
import jersey1 from '@/assets/jersey-1.jpg';
import jersey2 from '@/assets/jersey-2.jpg';
import bibShorts from '@/assets/bib-shorts.jpg';
import kidsJersey from '@/assets/kids-jersey.jpg';

export const products: Product[] = [
  {
    id: '1',
    name: 'Cuore Silver Race Jersey',
    price: 98.00,
    category: 'men',
    image: jersey1,
    colors: [
      { 
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jersey1, bibShorts, jersey2] // Multiple images for yellow
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jersey2, jersey1, kidsJersey] // Multiple images for pink
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
    image: bibShorts,
    colors: [
      { 
        name: 'Yellow', 
        code: '#FFFF00',
        images: [bibShorts, jersey1, jersey2]
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jersey2, bibShorts, kidsJersey]
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
    image: jersey2,
    colors: [
      { 
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jersey2, jersey1, bibShorts]
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jersey1, jersey2, kidsJersey]
      }
    ],
    sizes: [
      { name: 'XS', stock: 1 },
      { name: 'S', stock: 2 },
      { name: 'M', stock: 0 },
      { name: 'L', stock: 1 },
      { name: 'XL', stock: 2 }
    ]
  },
  {
    id: '4',
    name: 'Cuore Kids Race Jersey',
    price: 78.00,
    category: 'kids',
    image: kidsJersey,
    colors: [
      { 
        name: 'Yellow', 
        code: '#FFFF00',
        images: [kidsJersey, jersey1, jersey2]
      },
      { 
        name: 'Pink', 
        code: '#FF1493',
        images: [jersey2, kidsJersey, bibShorts]
      }
    ],
    sizes: [
      { name: 'XS', stock: 3 },
      { name: 'S', stock: 2 },
      { name: 'M', stock: 1 },
      { name: 'L', stock: 1 },
      { name: 'XL', stock: 0 }
    ]
  },
  {
    id: '5',
    name: 'Team Cap',
    price: 25.00,
    category: 'others',
    image: jersey1,
    colors: [
      { 
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jersey1, jersey2]
      }
    ],
    sizes: [
      { name: 'One Size', stock: 10 }
    ]
  },
  {
    id: '6',
    name: 'Team Water Bottle',
    price: 15.00,
    category: 'others',
    image: jersey2,
    colors: [
      { 
        name: 'Yellow', 
        code: '#FFFF00',
        images: [jersey2, jersey1]
      }
    ],
    sizes: [
      { name: '500ml', stock: 5 }
    ]
  }
];