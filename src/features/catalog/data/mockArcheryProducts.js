/**
 * 弓箭專用測試商品數據集 (Mock Archery Products)
 * 涵蓋反曲弓身、弓臂、箭桿(Spine)、配件與護具
 * 支援多幣別 (CNY, USD, JPY, EUR) 與彈性欄位 (相容詳細/簡略資訊)
 */

export const MOCK_ARCHERY_PRODUCTS = [
  {
    id: 'archery-001',
    sku: 'HOYT-FORMULA-XD-25',
    name: 'HOYT Formula XD 25寸 競技反曲弓身 (Recurve Riser)',
    brand: 'Hoyt',
    categoryPath: ['Recurve', 'Riser'],
    baseCurrency: 'USD',
    basePrice: 899.00,
    markupFactor: 1.05, // 運費與加成率
    images: [
      'https://images.unsplash.com/photo-1511094498305-6548777a835b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80'
    ],
    mainImage: 'https://images.unsplash.com/photo-1511094498305-6548777a835b?auto=format&fit=crop&w=800&q=80',
    attributes: {
      handedness: ['RH', 'LH'],
      interfaceSystem: 'Formula',
      lengthInch: 25,
      weightGrams: 1250,
      colorOptions: ['Cerakote Slate', 'Red Velvet', 'Cobalt Blue', 'Jet Black']
    },
    specifications: [
      { key: '弓身型號', value: 'Formula XD' },
      { key: '弓身長度', value: '25 英寸' },
      { key: '系統介面', value: 'Hoyt Formula System' },
      { key: '產地', value: '美國 (USA)' }
    ],
    tags: ['new', 'hot', 'import'],
    inStock: true,
    source: 'Official Import'
  },
  {
    id: 'archery-002',
    sku: 'TB-WW-NS-LIMBS',
    name: 'Win&Win Wiawis NS-G 碳纖維反曲弓臂 (Limbs)',
    brand: 'Win&Win',
    categoryPath: ['Recurve', 'Limbs'],
    baseCurrency: 'CNY',
    basePrice: 4200.00,
    markupFactor: 1.0,
    images: [
      'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80'
    ],
    mainImage: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80',
    attributes: {
      interfaceSystem: 'ILF',
      drawWeightlbs: [32, 34, 36, 38, 40, 42, 44],
      lengthInch: 68
    },
    specifications: [
      { key: '材質', value: 'Graphene Foam / High Modulus Carbon' },
      { key: '介面', value: '通用 ILF 介面' }
    ],
    tags: ['hot'],
    inStock: true,
    source: 'Taobao'
  },
  {
    id: 'archery-003',
    sku: 'TB-EASTON-X10-SHAFTS',
    name: 'Easton X10 頂級競技碳鋁箭桿 (12支裝)',
    brand: 'Easton',
    categoryPath: ['Arrows', 'Shaft'],
    baseCurrency: 'USD',
    basePrice: 450.00,
    markupFactor: 1.03,
    images: [
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80'
    ],
    mainImage: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
    attributes: {
      spine: [380, 410, 450, 500, 550, 600, 650, 700, 750, 830, 900, 1000]
    },
    specifications: [
      { key: '材質', value: 'High-strength carbon fiber bonded to 7075 alloy core' },
      { key: '直徑', value: '超細管徑 9.3/64"' }
    ],
    tags: ['hot', 'import'],
    inStock: true,
    source: 'Taobao Store Sync'
  },
  {
    id: 'archery-004',
    sku: 'TB-SHIBUYA-ULTIMA-RC3',
    name: 'Shibuya Ultima RC III 反曲弓金屬瞄準器',
    brand: 'Shibuya',
    categoryPath: ['Recurve', 'Sight'],
    baseCurrency: 'JPY',
    basePrice: 48000.00,
    markupFactor: 1.02,
    images: [
      'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80'
    ],
    mainImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
    attributes: {
      handedness: ['RH', 'LH'],
      colorOptions: ['Black', 'Silver', 'Blue', 'Red']
    },
    specifications: [
      { key: '產地', value: '日本 (Japan)' }
    ],
    tags: ['new'],
    inStock: true,
    source: 'Taobao Store Sync'
  },
  {
    id: 'archery-005',
    sku: 'TB-SANLIDA-CHEST-GUARD',
    name: '三利達 Sanlida 透氣防護護胸 (簡單配件無複雜規格樣本)',
    brand: 'Sanlida',
    categoryPath: ['Gear', 'ChestGuard'],
    baseCurrency: 'CNY',
    basePrice: 85.00,
    markupFactor: 1.0,
    images: [
      'https://images.unsplash.com/photo-1508873696983-2df515122519?auto=format&fit=crop&w=800&q=80'
    ],
    mainImage: 'https://images.unsplash.com/photo-1508873696983-2df515122519?auto=format&fit=crop&w=800&q=80',
    // 故意省略 attributes 示範彈性隱藏
    attributes: {},
    specifications: [],
    tags: [],
    inStock: true,
    source: 'Taobao Simple Import'
  }
];

export const MOCK_FLIPBOOK_PAGES = [
  {
    pageNumber: 1,
    title: '2026 競技反曲弓專題 (Recurve Archery Collection)',
    imageUrl: 'https://images.unsplash.com/photo-1511094498305-6548777a835b?auto=format&fit=crop&w=1200&q=80',
    hotspots: [
      {
        id: 'hs-1',
        x: 35, // 頁面相對 X 百分比
        y: 42, // 頁面相對 Y 百分比
        productId: 'archery-001',
        label: 'Hoyt Formula XD 弓身'
      },
      {
        id: 'hs-2',
        x: 65,
        y: 60,
        productId: 'archery-002',
        label: 'Win&Win NS-G 弓臂'
      }
    ]
  },
  {
    pageNumber: 2,
    title: '頂級箭枝與精準瞄準器材 (Arrows & Sights)',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
    hotspots: [
      {
        id: 'hs-3',
        x: 40,
        y: 50,
        productId: 'archery-003',
        label: 'Easton X10 碳鋁箭'
      },
      {
        id: 'hs-4',
        x: 75,
        y: 30,
        productId: 'archery-004',
        label: 'Shibuya Ultima RC3 瞄具'
      }
    ]
  }
];
