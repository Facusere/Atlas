import { getCache, setCache } from "./cacheStore.js";
import { safeUrl } from "../utils/sanitize.js";

const BANKNOTE_IMG_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const WIKI_CURRENCY_MAIN_PAGES = {
  USD: "United_States_dollar",
  EUR: "Euro",
  ARS: "Argentine_peso",
  BRL: "Brazilian_real",
  GBP: "Pound_sterling",
  JPY: "Japanese_yen",
  MXN: "Mexican_peso",
  CLP: "Chilean_peso",
  COP: "Colombian_peso",
  UYU: "Uruguayan_peso",
  PEN: "Peruvian_sol",
  CAD: "Canadian_dollar",
  AUD: "Australian_dollar",
  CHF: "Swiss_franc",
  CNY: "Renminbi",
  INR: "Indian_rupee",
  KRW: "South_Korean_won",
  RUB: "Russian_ruble",
  TRY: "Turkish_lira",
  ZAR: "South_African_rand",
  PYG: "Paraguayan_guaraní",
  BOB: "Bolivian_boliviano",
  DZD: "Algerian_dinar",
  MAD: "Moroccan_dirham",
  SEK: "Swedish_krona",
  NOK: "Norwegian_krone",
  DKK: "Danish_krone",
  PLN: "Polish_złoty",
  CZK: "Czech_koruna",
  HUF: "Hungarian_forint",
  ILS: "Israeli_new_shekel",
  AED: "United_Arab_Emirates_dirham",
  SAR: "Saudi_riyal",
  EGP: "Egyptian_pound",
  THB: "Thai_baht",
  SGD: "Singapore_dollar",
  NZD: "New_Zealand_dollar",
  HKD: "Hong_Kong_dollar",
  TWD: "New_Taiwan_dollar",
  VES: "Venezuelan_bolívar",
};

const WIKI_CURRENCY_BANKNOTE_PAGES = {
  USD: "Banknotes_of_the_United_States_dollar",
  EUR: "Euro_banknotes",
  GBP: "Banknotes_of_the_pound_sterling",
  JPY: "Banknotes_of_the_Japanese_yen",
  CAD: "Banknotes_of_the_Canadian_dollar",
  AUD: "Banknotes_of_the_Australian_dollar",
  CHF: "Banknotes_of_the_Swiss_franc",
  BRL: "Brazilian_real",
  MXN: "Mexican_peso",
  CLP: "Chilean_peso",
  COP: "Colombian_peso",
  UYU: "Uruguayan_peso",
  PEN: "Peruvian_sol",
  CNY: "Renminbi",
  INR: "Indian_rupee",
  KRW: "South_Korean_won",
  RUB: "Russian_ruble",
  TRY: "Turkish_lira",
  ZAR: "South_African_rand",
  PYG: "Paraguayan_guaraní",
  BOB: "Bolivian_boliviano",
  DZD: "Algerian_dinar",
  MAD: "Moroccan_dirham",
  SEK: "Swedish_krona",
  NOK: "Norwegian_krone",
  DKK: "Danish_krone",
  PLN: "Polish_złoty",
  CZK: "Czech_koruna",
  HUF: "Hungarian_forint",
  ILS: "Israeli_new_shekel",
  AED: "United_Arab_Emirates_dirham",
  SAR: "Saudi_riyal",
  EGP: "Egyptian_pound",
  THB: "Thai_baht",
  SGD: "Singapore_dollar",
  NZD: "New_Zealand_dollar",
  HKD: "Hong_Kong_dollar",
  TWD: "New_Taiwan_dollar",
  VES: "Venezuelan_bolívar",
};

const CURRENCY_CATALOG = {
  ARS: {
    name: "Peso argentino",
    symbol: "$",
    source: "BCRA (emisiones vigentes)",
    notes: [
      {
        v: 100,
        label: "$100",
        theme: "Taruca",
        bg: "#6d3b5c",
        accent: "#fce7f3",
        img: "https://www.bcra.gob.ar/wp-content/uploads/2024/08/inforgrafia-billete-100-pesos-14-2018-1280x1136.jpg",
      },
      {
        v: 200,
        label: "$200",
        theme: "Ballena Franca Austral",
        bg: "#1e5b82",
        accent: "#e0f2fe",
        img: "https://www.bcra.gob.ar/wp-content/uploads/2024/08/inforgrafia-billete-200-pesos-15-2016-980x845.jpg",
      },
      {
        v: 500,
        label: "$500",
        theme: "Yaguareté",
        bg: "#1f6a46",
        accent: "#dcfce7",
        img: "https://www.bcra.gob.ar/wp-content/uploads/2024/08/inforgrafia-billete-500-pesos-16-2016-1280x1116.jpg",
      },
      {
        v: 1000,
        label: "$1.000",
        theme: "Hornero",
        bg: "#c26b2a",
        accent: "#fde68a",
        img: "https://www.bcra.gob.ar/wp-content/uploads/2024/08/inforgrafia-billete-1000-pesos-17-2017-1280x1043.jpg",
      },
      {
        v: 1000,
        label: "$1.000",
        theme: "José de San Martín",
        bg: "#a85a24",
        accent: "#fef3c7",
        img: "https://www.bcra.gob.ar/wp-content/uploads/2024/08/inforgrafia-billete-1000-pesos-18-2023-980x810.jpg",
      },
      {
        v: 2000,
        label: "$2.000",
        theme: "Carrillo & Grierson",
        bg: "#6d526e",
        accent: "#f3e8ff",
        img: "https://www.bcra.gob.ar/archivos/Imagenes/Noticias/MEDIDAS-SEGURIDAD-PRENSA-Billete-$2000-CIRC-web2.jpg",
      },
      {
        v: 10000,
        label: "$10.000",
        theme: "Belgrano & Remedios del Valle",
        bg: "#2b6f6a",
        accent: "#ccfbf1",
        img: "https://www.bcra.gob.ar/wp-content/uploads/2024/08/inforgrafia-billete-10000-pesos-21-2024-1280x1091.jpg",
      },
      {
        v: 20000,
        label: "$20.000",
        theme: "Juan Bautista Alberdi",
        bg: "#2d5b8a",
        accent: "#dbeafe",
        img: "https://www.bcra.gob.ar/archivos/Imagenes/Noticias/MEDIDAS-SEGURIDAD-PRENSA-Billete-$20000-web.jpg",
      },
    ],
    coins: [],
  },
  USD: {
    name: "Dólar estadounidense",
    symbol: "$",
    notes: [
      { v: 1, label: "$1", theme: "Washington", bg: "#3d5a47", accent: "#dcfce7" },
      { v: 2, label: "$2", theme: "Jefferson", bg: "#445c4c", accent: "#dcfce7" },
      { v: 5, label: "$5", theme: "Lincoln", bg: "#4e5d52", accent: "#e2e8f0" },
      { v: 10, label: "$10", theme: "Hamilton", bg: "#786240", accent: "#fef3c7" },
      { v: 20, label: "$20", theme: "Jackson", bg: "#3a5f52", accent: "#d1fae5" },
      { v: 50, label: "$50", theme: "Grant", bg: "#6c525b", accent: "#fce7f3" },
      { v: 100, label: "$100", theme: "Franklin", bg: "#385e6a", accent: "#cffafe" },
    ],
    coins: [
      { v: 0.01, label: "1¢", metal: "bronze" },
      { v: 0.05, label: "5¢", metal: "silver" },
      { v: 0.1, label: "10¢", metal: "silver" },
      { v: 0.25, label: "25¢", metal: "silver" },
      { v: 1, label: "$1", metal: "gold" },
    ],
  },
  EUR: {
    name: "Euro",
    symbol: "€",
    notes: [
      { v: 5, label: "€5", theme: "Arquitectura clásica", bg: "#64748b", accent: "#f1f5f9" },
      { v: 10, label: "€10", theme: "Románico", bg: "#9f3a3a", accent: "#fee2e2" },
      { v: 20, label: "€20", theme: "Gótico", bg: "#2563eb", accent: "#dbeafe" },
      { v: 50, label: "€50", theme: "Renacimiento", bg: "#c2641e", accent: "#ffedd5" },
      { v: 100, label: "€100", theme: "Barroco", bg: "#2f7a44", accent: "#dcfce7" },
      { v: 200, label: "€200", theme: "Hierro y cristal", bg: "#a37b16", accent: "#fef9c3" },
    ],
    coins: [
      { v: 0.01, label: "1c", metal: "bronze" },
      { v: 0.02, label: "2c", metal: "bronze" },
      { v: 0.05, label: "5c", metal: "bronze" },
      { v: 0.1, label: "10c", metal: "gold" },
      { v: 0.2, label: "20c", metal: "gold" },
      { v: 0.5, label: "50c", metal: "gold" },
      { v: 1, label: "€1", metal: "bimetal" },
      { v: 2, label: "€2", metal: "bimetal" },
    ],
  },
  BRL: {
    name: "Real brasileño",
    symbol: "R$",
    notes: [
      { v: 2, label: "R$2", theme: "Tortuga marina", bg: "#2563eb", accent: "#dbeafe" },
      { v: 5, label: "R$5", theme: "Garza blanca", bg: "#7e22ce", accent: "#f3e8ff" },
      { v: 10, label: "R$10", theme: "Guacamayo", bg: "#b91c1c", accent: "#fee2e2" },
      { v: 20, label: "R$20", theme: "Tití león dorado", bg: "#b45309", accent: "#fef3c7" },
      { v: 50, label: "R$50", theme: "Jaguar", bg: "#925736", accent: "#ffedd5" },
      { v: 100, label: "R$100", theme: "Mero", bg: "#0e7490", accent: "#cffafe" },
      { v: 200, label: "R$200", theme: "Lobo de crin", bg: "#57534e", accent: "#f5f5f4" },
    ],
    coins: [
      { v: 0.05, label: "5c", metal: "bronze" },
      { v: 0.1, label: "10c", metal: "gold" },
      { v: 0.25, label: "25c", metal: "gold" },
      { v: 0.5, label: "50c", metal: "silver" },
      { v: 1, label: "R$1", metal: "bimetal" },
    ],
  },
  MXN: {
    name: "Peso mexicano",
    symbol: "$",
    notes: [
      { v: 20, label: "$20", theme: "Bicentenario", bg: "#15803d", accent: "#dcfce7" },
      { v: 50, label: "$50", theme: "Ajolote / Tenochtitlán", bg: "#9333ea", accent: "#f3e8ff" },
      { v: 100, label: "$100", theme: "Sor Juana Inés", bg: "#be123c", accent: "#ffe4e6" },
      { v: 200, label: "$200", theme: "Hidalgo & Morelos", bg: "#166534", accent: "#dcfce7" },
      { v: 500, label: "$500", theme: "Benito Juárez", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 1000, label: "$1.000", theme: "Revolución Mexicana", bg: "#6b21a8", accent: "#f3e8ff" },
    ],
    coins: [
      { v: 1, label: "$1", metal: "bimetal" },
      { v: 2, label: "$2", metal: "bimetal" },
      { v: 5, label: "$5", metal: "bimetal" },
      { v: 10, label: "$10", metal: "bimetal" },
    ],
  },
  CLP: {
    name: "Peso chileno",
    symbol: "$",
    notes: [
      { v: 1000, label: "$1.000", theme: "Ignacio Carrera Pinto", bg: "#15803d", accent: "#dcfce7" },
      { v: 2000, label: "$2.000", theme: "Manuel Rodríguez", bg: "#7e22ce", accent: "#f3e8ff" },
      { v: 5000, label: "$5.000", theme: "Gabriela Mistral", bg: "#b91c1c", accent: "#fee2e2" },
      { v: 10000, label: "$10.000", theme: "Arturo Prat", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 20000, label: "$20.000", theme: "Andrés Bello", bg: "#c2410c", accent: "#ffedd5" },
    ],
    coins: [
      { v: 10, label: "$10", metal: "gold" },
      { v: 50, label: "$50", metal: "gold" },
      { v: 100, label: "$100", metal: "bimetal" },
      { v: 500, label: "$500", metal: "bimetal" },
    ],
  },
  COP: {
    name: "Peso colombiano",
    symbol: "$",
    notes: [
      { v: 2000, label: "$2.000", theme: "Débora Arango", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 5000, label: "$5.000", theme: "José Asunción Silva", bg: "#854d0e", accent: "#fef9c3" },
      { v: 10000, label: "$10.000", theme: "Virginia Gutiérrez", bg: "#be123c", accent: "#ffe4e6" },
      { v: 20000, label: "$20.000", theme: "Alfonso López", bg: "#c2410c", accent: "#ffedd5" },
      { v: 50000, label: "$50.000", theme: "Gabriel García Márquez", bg: "#6b21a8", accent: "#f3e8ff" },
      { v: 100000, label: "$100.000", theme: "Carlos Lleras", bg: "#0f766e", accent: "#ccfbf1" },
    ],
    coins: [
      { v: 50, label: "$50", metal: "silver" },
      { v: 100, label: "$100", metal: "gold" },
      { v: 200, label: "$200", metal: "silver" },
      { v: 500, label: "$500", metal: "bimetal" },
      { v: 1000, label: "$1.000", metal: "bimetal" },
    ],
  },
  UYU: {
    name: "Peso uruguayo",
    symbol: "$",
    notes: [
      { v: 20, label: "$20", theme: "Zorrilla de San Martín", bg: "#0e7490", accent: "#cffafe" },
      { v: 50, label: "$50", theme: "José Pedro Varela", bg: "#be123c", accent: "#ffe4e6" },
      { v: 100, label: "$100", theme: "Eduardo Fabini", bg: "#7e22ce", accent: "#f3e8ff" },
      { v: 200, label: "$200", theme: "Pedro Figari", bg: "#9f1239", accent: "#ffe4e6" },
      { v: 500, label: "$500", theme: "Alfredo Vásquez", bg: "#15803d", accent: "#dcfce7" },
      { v: 1000, label: "$1.000", theme: "Juana de Ibarbourou", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 2000, label: "$2.000", theme: "Dámaso A. Larrañaga", bg: "#64748b", accent: "#f1f5f9" },
    ],
    coins: [
      { v: 1, label: "$1", metal: "gold" },
      { v: 2, label: "$2", metal: "gold" },
      { v: 5, label: "$5", metal: "gold" },
      { v: 10, label: "$10", metal: "bimetal" },
      { v: 50, label: "$50", metal: "gold" },
    ],
  },
  PEN: {
    name: "Sol peruano",
    symbol: "S/",
    notes: [
      { v: 10, label: "S/10", theme: "Chabuca Granda", bg: "#15803d", accent: "#dcfce7" },
      { v: 20, label: "S/20", theme: "José M. Arguedas", bg: "#92400e", accent: "#fef3c7" },
      { v: 50, label: "S/50", theme: "María Rostworowski", bg: "#be123c", accent: "#ffe4e6" },
      { v: 100, label: "S/100", theme: "Pedro Paulet", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 200, label: "S/200", theme: "Tilsa Tsuchiya", bg: "#6b21a8", accent: "#f3e8ff" },
    ],
    coins: [
      { v: 0.1, label: "10c", metal: "gold" },
      { v: 0.5, label: "50c", metal: "silver" },
      { v: 1, label: "S/1", metal: "silver" },
      { v: 2, label: "S/2", metal: "bimetal" },
      { v: 5, label: "S/5", metal: "bimetal" },
    ],
  },
  GBP: {
    name: "Libra esterlina",
    symbol: "£",
    notes: [
      { v: 5, label: "£5", theme: "Churchill", bg: "#0e7490", accent: "#cffafe" },
      { v: 10, label: "£10", theme: "Jane Austen", bg: "#b45309", accent: "#ffedd5" },
      { v: 20, label: "£20", theme: "J. M. W. Turner", bg: "#7e22ce", accent: "#f3e8ff" },
      { v: 50, label: "£50", theme: "Alan Turing", bg: "#9f1239", accent: "#ffe4e6" },
    ],
    coins: [
      { v: 0.05, label: "5p", metal: "silver" },
      { v: 0.1, label: "10p", metal: "silver" },
      { v: 0.2, label: "20p", metal: "silver" },
      { v: 0.5, label: "50p", metal: "silver" },
      { v: 1, label: "£1", metal: "bimetal" },
      { v: 2, label: "£2", metal: "bimetal" },
    ],
  },
  JPY: {
    name: "Yen japonés",
    symbol: "¥",
    notes: [
      { v: 1000, label: "¥1.000", theme: "Kitasato / Ola de Hokusai", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 5000, label: "¥5.000", theme: "Tsuda Umeko / Glicinia", bg: "#6b21a8", accent: "#f3e8ff" },
      { v: 10000, label: "¥10.000", theme: "Shibusawa Eiichi", bg: "#854d0e", accent: "#fef3c7" },
    ],
    coins: [
      { v: 1, label: "¥1", metal: "silver" },
      { v: 5, label: "¥5", metal: "gold" },
      { v: 10, label: "¥10", metal: "bronze" },
      { v: 50, label: "¥50", metal: "silver" },
      { v: 100, label: "¥100", metal: "silver" },
      { v: 500, label: "¥500", metal: "bimetal" },
    ],
  },
  CAD: {
    name: "Dólar canadiense",
    symbol: "CA$",
    notes: [
      { v: 5, label: "$5", theme: "Wilfrid Laurier", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 10, label: "$10", theme: "Viola Desmond", bg: "#6b21a8", accent: "#f3e8ff" },
      { v: 20, label: "$20", theme: "Memorial Vimy", bg: "#15803d", accent: "#dcfce7" },
      { v: 50, label: "$50", theme: "Rompehielos Amundsen", bg: "#be123c", accent: "#ffe4e6" },
      { v: 100, label: "$100", theme: "Innovación médica", bg: "#92400e", accent: "#fef3c7" },
    ],
    coins: [
      { v: 0.05, label: "5¢", metal: "silver" },
      { v: 0.1, label: "10¢", metal: "silver" },
      { v: 0.25, label: "25¢", metal: "silver" },
      { v: 1, label: "$1", metal: "gold" },
      { v: 2, label: "$2", metal: "bimetal" },
    ],
  },
  AUD: {
    name: "Dólar australiano",
    symbol: "A$",
    notes: [
      { v: 5, label: "$5", theme: "Parlamento", bg: "#9333ea", accent: "#f3e8ff" },
      { v: 10, label: "$10", theme: "Banjo Paterson", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 20, label: "$20", theme: "Mary Reibey", bg: "#c2410c", accent: "#ffedd5" },
      { v: 50, label: "$50", theme: "David Unaipon", bg: "#a16207", accent: "#fef9c3" },
      { v: 100, label: "$100", theme: "Nellie Melba", bg: "#15803d", accent: "#dcfce7" },
    ],
    coins: [
      { v: 0.05, label: "5c", metal: "silver" },
      { v: 0.1, label: "10c", metal: "silver" },
      { v: 0.2, label: "20c", metal: "silver" },
      { v: 0.5, label: "50c", metal: "silver" },
      { v: 1, label: "$1", metal: "gold" },
      { v: 2, label: "$2", metal: "gold" },
    ],
  },
  CHF: {
    name: "Franco suizo",
    symbol: "CHF",
    notes: [
      { v: 10, label: "10 Fr.", theme: "Tiempo", bg: "#a16207", accent: "#fef9c3" },
      { v: 20, label: "20 Fr.", theme: "Luz", bg: "#b91c1c", accent: "#fee2e2" },
      { v: 50, label: "50 Fr.", theme: "Viento", bg: "#15803d", accent: "#dcfce7" },
      { v: 100, label: "100 Fr.", theme: "Agua", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 200, label: "200 Fr.", theme: "Materia", bg: "#78350f", accent: "#fef3c7" },
      { v: 1000, label: "1.000 Fr.", theme: "Lenguaje", bg: "#6b21a8", accent: "#f3e8ff" },
    ],
    coins: [
      { v: 0.1, label: "10 Rp", metal: "silver" },
      { v: 0.2, label: "20 Rp", metal: "silver" },
      { v: 0.5, label: "½ Fr", metal: "silver" },
      { v: 1, label: "1 Fr", metal: "silver" },
      { v: 2, label: "2 Fr", metal: "silver" },
      { v: 5, label: "5 Fr", metal: "silver" },
    ],
  },
  CNY: {
    name: "Yuan chino",
    symbol: "¥",
    notes: [
      { v: 1, label: "¥1", theme: "Tres Estanques", bg: "#3f6212", accent: "#ecfccb" },
      { v: 5, label: "¥5", theme: "Monte Tai", bg: "#6b21a8", accent: "#f3e8ff" },
      { v: 10, label: "¥10", theme: "Tres Gargantas", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 20, label: "¥20", theme: "Río Li (Guilin)", bg: "#9a3412", accent: "#ffedd5" },
      { v: 50, label: "¥50", theme: "Palacio Potala", bg: "#115e59", accent: "#ccfbf1" },
      { v: 100, label: "¥100", theme: "Gran Salón del Pueblo", bg: "#be123c", accent: "#ffe4e6" },
    ],
    coins: [
      { v: 0.1, label: "1 角", metal: "silver" },
      { v: 0.5, label: "5 角", metal: "gold" },
      { v: 1, label: "¥1", metal: "silver" },
    ],
  },
  INR: {
    name: "Rupia india",
    symbol: "₹",
    notes: [
      { v: 10, label: "₹10", theme: "Templo del Sol Konark", bg: "#78350f", accent: "#fef3c7" },
      { v: 20, label: "₹20", theme: "Cuevas de Ellora", bg: "#4d7c0f", accent: "#ecfccb" },
      { v: 50, label: "₹50", theme: "Hampi", bg: "#0369a1", accent: "#e0f2fe" },
      { v: 100, label: "₹100", theme: "Rani ki Vav", bg: "#6b21a8", accent: "#f3e8ff" },
      { v: 200, label: "₹200", theme: "Estupa de Sanchi", bg: "#c2410c", accent: "#ffedd5" },
      { v: 500, label: "₹500", theme: "Fuerte Rojo", bg: "#475569", accent: "#f1f5f9" },
    ],
    coins: [
      { v: 1, label: "₹1", metal: "silver" },
      { v: 2, label: "₹2", metal: "silver" },
      { v: 5, label: "₹5", metal: "gold" },
      { v: 10, label: "₹10", metal: "bimetal" },
      { v: 20, label: "₹20", metal: "bimetal" },
    ],
  },
  KRW: {
    name: "Won surcoreano",
    symbol: "₩",
    notes: [
      { v: 1000, label: "₩1.000", theme: "Yi Hwang", bg: "#1d4ed8", accent: "#dbeafe" },
      { v: 5000, label: "₩5.000", theme: "Yi I", bg: "#c2410c", accent: "#ffedd5" },
      { v: 10000, label: "₩10.000", theme: "Rey Sejong", bg: "#15803d", accent: "#dcfce7" },
      { v: 50000, label: "₩50.000", theme: "Shin Saimdang", bg: "#a16207", accent: "#fef9c3" },
    ],
    coins: [
      { v: 10, label: "₩10", metal: "bronze" },
      { v: 50, label: "₩50", metal: "silver" },
      { v: 100, label: "₩100", metal: "silver" },
      { v: 500, label: "₩500", metal: "silver" },
    ],
  },
  DZD: {
    name: "Dinar argelino",
    symbol: "د.ج",
    notes: [
      { v: 500, label: "500 DA", theme: "Alcomsat-1", bg: "#6b21a8", accent: "#f3e8ff" },
      { v: 1000, label: "1.000 DA", theme: "Gran Mezquita de Argel", bg: "#15803d", accent: "#dcfce7" },
      { v: 2000, label: "2.000 DA", theme: "Mártires / Revolución", bg: "#9f1239", accent: "#ffe4e6" },
    ],
    coins: [
      { v: 5, label: "5 DA", metal: "silver" },
      { v: 10, label: "10 DA", metal: "bimetal" },
      { v: 20, label: "20 DA", metal: "bimetal" },
      { v: 50, label: "50 DA", metal: "bimetal" },
      { v: 100, label: "100 DA", metal: "bimetal" },
      { v: 200, label: "200 DA", metal: "bimetal" },
    ],
  },
};

const NOTE_PALETTE = [
  { bg: "#0f766e", accent: "#ccfbf1" },
  { bg: "#1d4ed8", accent: "#dbeafe" },
  { bg: "#6d28d9", accent: "#ede9fe" },
  { bg: "#b45309", accent: "#fef3c7" },
  { bg: "#9f1239", accent: "#ffe4e6" },
  { bg: "#15803d", accent: "#dcfce7" },
];

const SUBUNIT_RE =
  /\b(?:c|ct|cts|cent|cents|centavo|centavos|centimo|c[eê]ntimos|pt|piastre|piastres|pence|p|pfennig|ore|öre|ø|satang|sen|halala|kurus|kuruş|grosz|groszy|fillér|santim|santimat|millime|ban|bani|stotinki|paise|paisa|pya|poisha|thebe|ngwee|tambala|kobo|pesewa|butut|centime|centimes|kopek|kopeck|qep|rp|rappen)\b/i;

function normalizePageTitle(rawTitle) {
  const clean = String(rawTitle || "").trim().replace(/\s+/g, "_");
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function extractInfoboxField(wikitext, candidateFields) {
  for (const field of candidateFields) {
    const re = new RegExp(`^\\|\\s*${field}\\s*=([\\s\\S]*?)(?=\\n\\s*\\||\\n\\s*\\}\\})`, "mi");
    const match = wikitext.match(re);
    if (match) {
      return match[1].trim();
    }
  }
  return "";
}

function cleanWikiValue(raw) {
  if (!raw) return "";
  let txt = String(raw);
  txt = txt.replace(/<!--[\s\S]*?-->/g, " ");
  txt = txt.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, " ");
  txt = txt.replace(/<ref\b[^>]*\/>/gi, " ");
  txt = txt.replace(/<br\s*\/?>/gi, ", ");
  txt = txt.replace(/<[^>]+>/g, " ");
  txt = txt.replace(/&nbsp;/gi, " ");
  txt = txt.replace(/\{\{\s*(?:efn|sfn|cite|cn|citation needed)[\s\S]*?\}\}/gi, " ");
  txt = txt.replace(/\{\{(?:nowrap|small|abbr|lang\|[^|}]+)\|([^}]+)\}\}/gi, "$1");
  txt = txt.replace(/\{\{[^{}]*\}\}/g, " ");
  txt = txt.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
  txt = txt.replace(/\[\[([^\]]+)\]\]/g, "$1");
  txt = txt.replace(/'''?/g, "");
  txt = txt.replace(/\([^)]*\)/g, " ");
  txt = txt.replace(/\s+/g, " ").trim();
  return txt;
}

function formatDenominationNumber(v) {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0.5) return "0,5";
  if (v === 0.25) return "0,25";
  if (v > 0 && v < 1) return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(v);
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(v);
}

function parseDenominationTokens(cleanedText, sym, cleanCode, isCoin) {
  if (!cleanedText || /^(?:none|no|n\/a|—|-)$/i.test(cleanedText)) return [];
  if (/\bno\s+banknotes|\bno\s+coins/i.test(cleanedText)) return [];

  // Normalize comma/dot decimals vs thousand separators (e.g. "1,000" -> "1000", "20,000" -> "20000")
  const preNormalized = cleanedText.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");
  const rawTokens = preNormalized
    .split(/[,;&•·\n|]|\band\b|\by\b/i)
    .map((t) => t.trim())
    .filter(Boolean);

  // Detect suffix text unit at the end (e.g. "DA", "kr", "DH", "dirhams", "pesos")
  const lastTextMatch = cleanedText.match(/(?:^|\s)(DA|DH|kr|CHF|TL|zł|lei|lev|BGN|RON|SAR|AED|QAR|OMR|KWD|BHD|JOD|MAD)\s*$/i);
  const trailingUnit = lastTextMatch ? lastTextMatch[1] : "";

  const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
  const parsed = [];
  const seen = new Set();

  for (const token of rawTokens) {
    let working = token.replace(/½/g, "0.5").replace(/¼/g, "0.25");
    const numMatch = working.match(/(\d+(?:\.\d+)?)/);
    if (!numMatch) continue;

    let rawNum = Number(numMatch[1]);
    if (!Number.isFinite(rawNum) || rawNum <= 0) continue;

    // Ignore obvious four-digit calendar years embedded in notes (rarely happen after parens stripped, except "since 2019")
    if (/(?:since|from|before|after|until|year|issued|series)\s+\d{4}/i.test(working)) continue;

    const isSubunit = SUBUNIT_RE.test(working) || /¢$/.test(working) || /\d\s*c\b/i.test(working);
    const converterVal = isSubunit && rawNum >= 1 ? rawNum / 100 : rawNum;

    let label = "";
    if (/^[£$€¥₹₩₺₴₦₫฿₱₪]/i.test(working) || /\b(?:PT|DA|DH|kr|Rs|RM|S\/|R\$)\b/i.test(working) || /[¢c]$/i.test(working)) {
      label = working
        .replace(/(\d)(?=\d{3}(?:\D|$))/g, "$1.")
        .replace(/\bdirhams?\b|\bpesos?\b|\bdinars?\b|\bpounds?\b|\bdollars?\b|\beuros?\b|\bfrancs?\b|\byen\b|\bwon\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    } else if (trailingUnit) {
      label = `${nf.format(rawNum)} ${trailingUnit}`;
    } else {
      const safeSym = sym || cleanCode;
      label = safeSym.length <= 2 ? `${safeSym}${nf.format(rawNum)}` : `${nf.format(rawNum)} ${safeSym}`;
    }

    if (!label) label = `${sym || cleanCode} ${formatDenominationNumber(rawNum)}`;

    const key = `${converterVal}:${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (isCoin) {
      let metal = "silver";
      if (converterVal < 0.25) metal = "bronze";
      else if (converterVal < 2) metal = "gold";
      else metal = "bimetal";
      parsed.push({ v: converterVal, label, metal });
    } else {
      const palette = NOTE_PALETTE[parsed.length % NOTE_PALETTE.length];
      parsed.push({
        v: rawNum,
        label,
        theme: "En circulación",
        bg: palette.bg,
        accent: palette.accent,
      });
    }

    if (parsed.length >= 12) break;
  }

  return parsed;
}

/**
 * Returns verified circulating banknotes and coins for known currencies,
 * or an empty scaffold (never fabricating coins or values) to enrich via Wikipedia.
 */
export function getCurrencyShowcase(code, symbol = "", name = "") {
  const cleanCode = String(code || "USD").toUpperCase();
  const entry = CURRENCY_CATALOG[cleanCode];
  if (entry) {
    return {
      code: cleanCode,
      name: entry.name,
      symbol: entry.symbol,
      source: entry.source || "Catálogo verificado + Wikimedia",
      isSpecific: true,
      notes: entry.notes.map((n) => ({ ...n })),
      coins: entry.coins.map((c) => ({ ...c })),
    };
  }

  return {
    code: cleanCode,
    name: name || cleanCode,
    symbol: symbol || cleanCode,
    source: "",
    isSpecific: false,
    notes: [],
    coins: [],
  };
}

/**
 * Queries Wikipedia Action API (`Infobox currency`) for currently circulating
 * banknotes, coins, and dedicated banknote article of any currency.
 */
export async function fetchCurrencyWikiInfo(code, fallbackName = "", symbol = "") {
  const cleanCode = String(code || "").toUpperCase();
  if (!cleanCode) return null;

  const cacheKey = `atlas:currency-wiki:v2:${cleanCode}`;
  const cached = getCache(cacheKey);
  if (cached && typeof cached === "object") return cached;

  const pageTitle = normalizePageTitle(WIKI_CURRENCY_MAIN_PAGES[cleanCode] || fallbackName);
  if (!pageTitle) return null;

  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content` +
      `&rvslots=main&rvsection=0&redirects=1&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("json")) return null;
    const data = await res.json();

    const pages = Object.values(data?.query?.pages || {});
    const page = pages[0];
    if (!page || page.missing !== undefined) return null;

    const wikitext = page.revisions?.[0]?.slots?.main?.["*"] || "";
    if (!/Infobox\s+currency/i.test(wikitext)) return null;

    const rawNotes = extractInfoboxField(wikitext, ["frequently_used_banknotes", "used_banknotes"]);
    const rawCoins = extractInfoboxField(wikitext, ["frequently_used_coins", "used_coins"]);
    const rawArticle = extractInfoboxField(wikitext, ["banknote_article"]);

    const cleanNotes = cleanWikiValue(rawNotes);
    const cleanCoins = cleanWikiValue(rawCoins);
    const banknoteArticle = cleanWikiValue(rawArticle).replace(/\s+/g, "_");

    const notes = parseDenominationTokens(cleanNotes, symbol, cleanCode, false);
    const coins = parseDenominationTokens(cleanCoins, symbol, cleanCode, true);

    const parsed = {
      pageTitle: normalizePageTitle(page.title || pageTitle),
      banknoteArticle,
      notes,
      coins,
    };

    setCache(cacheKey, parsed, BANKNOTE_IMG_TTL_MS);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Fetches real banknote image URLs from Wikipedia REST media-list for non-ARS currencies.
 */
export async function fetchCurrencyImages(code, fallbackName = "", preferredArticle = "") {
  const cleanCode = String(code || "").toUpperCase();
  if (!cleanCode || cleanCode === "ARS") return [];

  const targetPage = normalizePageTitle(
    preferredArticle || WIKI_CURRENCY_BANKNOTE_PAGES[cleanCode] || WIKI_CURRENCY_MAIN_PAGES[cleanCode] || fallbackName
  );
  if (!targetPage) return [];

  const cacheKey = `atlas:banknotes:v3:${cleanCode}:${targetPage}`;
  const cached = getCache(cacheKey);
  if (Array.isArray(cached)) return cached;

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(targetPage)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("json")) return [];
    const data = await res.json();

    const filtered = (data.items || [])
      .filter((item) => item?.type === "image" && Array.isArray(item.srcset) && item.srcset.length > 0)
      .map((item) => {
        const preferred =
          item.srcset.find((s) => /\/(?:500|330|640|800)px-/.test(s.src || "")) ||
          item.srcset[0];
        const rawSrc = preferred?.src || "";
        const fullSrc = rawSrc.startsWith("//") ? `https:${rawSrc}` : rawSrc;
        return {
          title: String(item.title || ""),
          src: safeUrl(fullSrc),
        };
      })
      .filter(
        (x) =>
          x.src &&
          !/\/(?:20|30|40|50|60|80|100|120)px-/.test(x.src) &&
          !/\.svg|\.gif|\.tif/i.test(x.title) &&
          /\.(jpg|jpeg|png|webp)(\?|$)/i.test(x.src) &&
          !/seal|map|chart|graph|exchange_rate|per_US_dollar|flag|logo|icon|coin|cent\b|cents\b|centavo|centime|pfennig|qersh|piastre|piastres|\bept\b|\bpara\b|milim|reverse|back\b|reverso|dorso|uv|infrared|holographic|signature|untersch|mikro|micro|serial_number|druckplatten|bruecke|aufgefaechert|hand|printing|cropped|portrait|series\.png|selection\.png|collage_|18\d\d|19[0-7]\d|continental|confederate|specimen/i.test(
            x.title
          )
      );

    setCache(cacheKey, filtered, BANKNOTE_IMG_TTL_MS);
    return filtered;
  } catch {
    return [];
  }
}

function cleanFilenameForMatch(title) {
  return String(title || "")
    .replace(/^File:/i, "")
    .replace(/\.(?:jpe?g|png|webp)$/i, "")
    .replace(/\d{4}-\d{1,2}-\d{1,2}/g, " ")
    .replace(/(?:^|[^0-9])\d{4}\(\d+\)/g, " ")
    .replace(/\(\d{4}\)/g, " ");
}

function buildValueMatchRegex(val) {
  const numStr = String(val);
  const withSep =
    numStr.length >= 4 && /^\d+$/.test(numStr)
      ? numStr.replace(/\B(?=(\d{3})+$)/g, "[,._]?")
      : numStr.replace(".", "[.,]");
  // Guard against matching decimal parts like 0.50 when searching 50
  return new RegExp(`(?:^|[^0-9.])${withSep}(?:[^0-9.]|$)`);
}

function scoreImageMatch(title, val) {
  let score = 2;
  if (/obverse|front|anverso|frente/i.test(title)) score += 4;
  if (/(?:^|_)g_|europa|second_obverse|polymer|202\d/i.test(title)) score += 5;
  else if (/(?:^|_)[ef]_|series_[efg]|201[3-9]/i.test(title)) score += 3;
  if (/issue|series|note|banknote|bill|dirham|peso|euro|yen|pound|dollar|real|dinar|franc|krona|rupee|won|EGP|USD|EUR|BRL|GBP|JPY|MXN/i.test(title)) {
    score += 1;
  }
  if (/first_obverse|series_[abcd]|(?:^|_)[abcd]_|198\d|199\d|old_/i.test(title)) score -= 3;
  // Never match a fractional filename (e.g. 0.50_EGP) to an integer >= 1
  if (val >= 1 && /(?:^|[^0-9])0[.,]\d+/.test(title)) return -20;
  // Penalize potential year false positive (e.g. "-2000-" in a 20-unit note)
  if ((val === 2000 || val === 1000) && /\d{1,3}[-_ ].*?(?:199\d|200\d|201\d|202\d)/.test(title)) {
    const valRe = buildValueMatchRegex(val);
    const cleaned = title.replace(/[-_ ](?:199\d|200\d|201\d|202\d)(?:[-_ .]|$)/g, " ");
    if (!valRe.test(cleaned)) score -= 12;
  }
  return score;
}

/**
 * Matches verified Wikimedia banknote photos ONLY when the filename accurately matches
 * the banknote denomination (never assigning unrelated random photos).
 */
export function attachBanknotePhotos(showcase, images) {
  if (!Array.isArray(images) || images.length === 0) return showcase;
  const used = new Set();

  const notesWithImg = showcase.notes.map((note) => {
    if (note.img) return note;
    const valRe = buildValueMatchRegex(note.v);
    const candidates = images
      .filter((im) => !used.has(im.src) && valRe.test(cleanFilenameForMatch(im.title)))
      .map((im) => ({ ...im, score: scoreImageMatch(cleanFilenameForMatch(im.title), note.v) }))
      .filter((im) => im.score >= 0)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    if (best) {
      used.add(best.src);
      return { ...note, img: best.src };
    }
    return note;
  });

  return { ...showcase, notes: notesWithImg };
}

/**
 * Enriches any currency showcase using official BCRA / verified catalog data
 * plus Wikipedia Infobox currency & Wikimedia REST media-list when needed.
 */
export async function enrichCurrencyShowcase(baseShowcase) {
  if (!baseShowcase || !baseShowcase.code) return baseShowcase;
  if (baseShowcase.code === "ARS") return baseShowcase;

  let current = baseShowcase;
  let preferredArticle = "";

  // Unlisted currency: query Wikipedia Infobox currency for genuine circulating notes & coins
  if (!current.isSpecific) {
    const wikiInfo = await fetchCurrencyWikiInfo(current.code, current.name, current.symbol);
    if (wikiInfo) {
      preferredArticle = wikiInfo.banknoteArticle || wikiInfo.pageTitle || "";
      current = {
        ...current,
        source: "Wikipedia (Infobox oficial)",
        notes: wikiInfo.notes || [],
        coins: wikiInfo.coins || [],
      };
    }
  }

  // Only fetch banknote photos when there are notes without images
  if (current.notes.some((n) => !n.img)) {
    let imgs = await fetchCurrencyImages(current.code, current.name, preferredArticle);
    // If dedicated banknote article returned nothing or had sparse matches, also check main currency page
    if (!imgs.length && WIKI_CURRENCY_MAIN_PAGES[current.code] && WIKI_CURRENCY_BANKNOTE_PAGES[current.code] !== WIKI_CURRENCY_MAIN_PAGES[current.code]) {
      imgs = await fetchCurrencyImages(current.code, current.name, WIKI_CURRENCY_MAIN_PAGES[current.code]);
    }
    if (imgs.length) {
      current = attachBanknotePhotos(current, imgs);
    }
  }

  return current;
}
