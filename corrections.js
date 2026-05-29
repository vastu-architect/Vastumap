/*
 * Vastu Studio correction catalog.
 * To add an object, insert one item into a category below. The editor,
 * project JSON and export pipeline will pick it up automatically.
 */
window.CORRECTION_LIBRARY = {
  materials: [
    { id: "copper", name: "Медь", color: "#be744f" },
    { id: "iron", name: "Железо", color: "#606975" },
    { id: "zinc", name: "Цинк", color: "#9eacb3" },
    { id: "lead", name: "Свинец", color: "#697083" },
    { id: "bronze", name: "Бронза", color: "#947040" }
  ],
  spiralShapes: [
    { id: "circle", name: "Круглая" },
    { id: "square", name: "Квадратная" },
    { id: "triangle", name: "Треугольная" }
  ],
  spiralQuantities: [1, 5, 7, 9],
  stoneGroupQuantities: [1, 3, 4, 5, 7, 9],
  spiralArrangements: [
    { id: "compact", name: "Компактно" },
    { id: "line", name: "В одну линию" }
  ],
  categories: [
    {
      id: "stones",
      name: "Камни",
      icon: "gem",
      items: [
        { id: "ruby", name: "Рубин", visual: "stone", color: "#a82f42", weight: 10 },
        { id: "emerald", name: "Изумруд", visual: "stone", color: "#25845f", weight: 10 },
        { id: "yellow-sapphire", name: "Желтый сапфир", visual: "stone", color: "#d8a538", weight: 10 },
        { id: "blue-sapphire", name: "Синий сапфир", visual: "stone", color: "#345f9e", weight: 10 },
        { id: "diamond", name: "Бриллиант", visual: "stone", color: "#dcecf3", weight: 10 },
        { id: "rock-crystal", name: "Горный хрусталь", visual: "stone", color: "#c4e1eb", weight: 10 },
        { id: "river-yellow", name: "Речной желтый", visual: "pebble", color: "#cfa954", weight: 50, groupable: true, quantity: 1, keepRatio: false },
        { id: "river-blue", name: "Речной синий", visual: "pebble", color: "#568fa4", weight: 50, groupable: true, quantity: 1, keepRatio: false },
        { id: "red-coral", name: "Красный коралл", visual: "coral", color: "#cc503d", weight: 10 },
        { id: "cats-eye", name: "Кошачий глаз (хрисоберил)", visual: "stone", color: "#a8954c", weight: 10 },
        { id: "hessonite", name: "Гессонит", visual: "stone", color: "#a45a38", weight: 10 },
        { id: "pearl", name: "Жемчуг", visual: "pearl", color: "#ebe4d9", weight: 10 }
      ]
    },
    {
      id: "spirals",
      name: "Спирали",
      icon: "spiral",
      items: [
        { id: "spiral", name: "Спираль", visual: "spiral", material: "copper", shape: "circle", quantity: 1, arrangement: "compact", size: 100, keepRatio: false }
      ]
    },
    {
      id: "wires",
      name: "Проволоки",
      icon: "wire",
      items: [
        { id: "wire-copper", name: "Медная проволока", visual: "wire", color: "#be744f", size: 220, aspect: 7, keepRatio: false },
        { id: "wire-bronze", name: "Бронзовая проволока", visual: "wire", color: "#947040", size: 220, aspect: 7, keepRatio: false }
      ]
    },
    {
      id: "metals",
      name: "Металлы",
      icon: "metal",
      items: [
        { id: "metal-copper", name: "Медь", visual: "metal", color: "#be744f", weight: 100 },
        { id: "metal-bronze", name: "Бронза", visual: "metal", color: "#947040", weight: 100 },
        { id: "metal-lead", name: "Свинец", visual: "metal", color: "#697083", weight: 100 },
        { id: "metal-silver", name: "Серебро", visual: "metal", color: "#b9c4ce", weight: 100 },
        { id: "metal-gold", name: "Золото", visual: "metal", color: "#d4a432", weight: 100 },
        { id: "metal-iron", name: "Железо", visual: "metal", color: "#606975", weight: 100 }
      ]
    },
    {
      id: "lingams",
      name: "Лингамы",
      icon: "lingam",
      items: [
        { id: "lingam-copper", name: "Медный лингам", visual: "lingam", color: "#be744f", measurable: false },
        { id: "lingam-iron", name: "Железный лингам", visual: "lingam", color: "#606975", measurable: false },
        { id: "lingam-lead", name: "Свинцовый лингам", visual: "lingam", color: "#697083", measurable: false },
        { id: "lingam-bronze", name: "Бронзовый лингам", visual: "lingam", color: "#947040", measurable: false },
        { id: "lingam-silver", name: "Серебряный лингам", visual: "lingam", color: "#b9c4ce", measurable: false },
        { id: "lingam-yellow-stone", name: "Лингам из желтого камня", visual: "lingam", color: "#cba64a", measurable: false },
        { id: "lingam-crystal", name: "Хрустальный лингам", visual: "lingam", color: "#c4e1eb", measurable: false }
      ]
    },
    {
      id: "pyramids",
      name: "Пирамиды",
      icon: "pyramid",
      items: [
        { id: "pyramid-copper", name: "Медная пирамида", visual: "pyramid", color: "#be744f", weight: 100 },
        { id: "pyramid-iron", name: "Железная пирамида", visual: "pyramid", color: "#606975", weight: 100 },
        { id: "pyramid-lead", name: "Свинцовая пирамида", visual: "pyramid", color: "#697083", weight: 100 }
      ]
    },
    {
      id: "films",
      name: "Пленки и шторы",
      icon: "film",
      items: [
        { id: "film-bronze", name: "Бронзовая пленка", visual: "film", color: "#a6764c", measurable: false, aspect: 1.6 },
        { id: "film-yellow", name: "Желтая пленка", visual: "film", color: "#e0ba52", measurable: false, aspect: 1.6 },
        { id: "film-blue", name: "Голубая пленка", visual: "film", color: "#7fc9dc", measurable: false, aspect: 1.6 },
        { id: "curtains-dense", name: "Плотные шторы", visual: "curtain", color: "#6e7484", measurable: false, aspect: 1.4 }
      ]
    },
    {
      id: "toilet-corrections",
      name: "Коррекции туалетов",
      icon: "toilet",
      items: [
        { id: "toilet-inflow", name: "Туалет: зоны притока", visual: "toilet-correction", color: "#75c7ca", accent: "#6b837f", measurable: false, size: 150, aspect: 0.9, keepRatio: false },
        { id: "toilet-outflow", name: "Туалет: зоны оттока", visual: "toilet-triangles", color: "#b3927d", accent: "#e07b39", measurable: false, size: 150, aspect: 0.9, keepRatio: false }
      ]
    },
    {
      id: "brahmasthan-corrections",
      name: "Брахмастан",
      icon: "brahma",
      items: []
    },
    {
      id: "interior",
      name: "Обстановка",
      icon: "interior",
      items: [
        { id: "fire", name: "Огонь", visual: "fire", color: "#dc6235", measurable: false, size: 80 },
        { id: "kitchen", name: "Кухня", visual: "kitchen", color: "#a97952", measurable: false, size: 110, aspect: 1.3 },
        { id: "bed", name: "Кровать", visual: "bed", color: "#658194", measurable: false, size: 130, aspect: 1.65 },
        { id: "toilet", name: "Унитаз", visual: "toilet", color: "#90b2bf", measurable: false, size: 80 },
        { id: "sink", name: "Раковина", visual: "sink", color: "#7ca6b5", measurable: false, size: 90 },
        { id: "wardrobe", name: "Гардероб", visual: "wardrobe", color: "#9b7455", measurable: false, size: 95, aspect: 0.8 },
        { id: "sofa", name: "Диван", visual: "sofa", color: "#7c8370", measurable: false, size: 130, aspect: 1.8 },
        { id: "table", name: "Стол", visual: "table", color: "#a87852", measurable: false, size: 100 },
        { id: "entrance-door", name: "Входная дверь", visual: "door", color: "#866345", measurable: false, size: 105, aspect: 1.3 }
      ]
    },
    {
      id: "other",
      name: "Другое",
      icon: "other",
      items: [
        { id: "turmeric", name: "Куркума", visual: "powder", color: "#dd9b2f", weight: 100 },
        { id: "plants", name: "Растения", visual: "plant", color: "#4f9861", measurable: false },
        { id: "blue-bottle", name: "Синяя бутылка", visual: "bottle", color: "#376f9e", measurable: false },
        { id: "wind-chime", name: "Музыка ветра", visual: "chime", color: "#c0c5ca", measurable: false },
        { id: "crystal-bowl", name: "Чаша хрустальная", visual: "bowl", color: "#bcdde8", measurable: false }
      ]
    },
    {
      id: "yantras",
      name: "Янтры и зеркала",
      icon: "yantra",
      items: [
        { id: "yantra-gold", name: "Янтра", visual: "yantra", color: "#cc9f3d", measurable: false },
        { id: "mirror", name: "Зеркало", visual: "mirror", color: "#b8d9e5", measurable: false }
      ]
    }
  ]
};
