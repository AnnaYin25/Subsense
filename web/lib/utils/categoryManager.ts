const CUSTOM_CATEGORIES_KEY = 'custom_categories';
const DEFAULT_CATEGORIES = ['Entertainment', 'Productivity', 'Utilities', 'Health'];

export const getAllCategories = async (): Promise<string[]> => {
  try {
    const customCategoriesJson = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const customCategories = customCategoriesJson ? JSON.parse(customCategoriesJson) : [];
    return [...DEFAULT_CATEGORIES, ...customCategories];
  } catch (error) {
    console.error('Error loading categories:', error);
    return DEFAULT_CATEGORIES;
  }
};

export const addCustomCategory = async (categoryName: string): Promise<boolean> => {
  try {
    const trimmed = categoryName.trim();
    if (!trimmed || DEFAULT_CATEGORIES.includes(trimmed)) return false;

    const customCategoriesJson = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const customCategories = customCategoriesJson ? JSON.parse(customCategoriesJson) : [];

    if (!customCategories.includes(trimmed)) {
      customCategories.push(trimmed);
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
    }
    return true;
  } catch (error) {
    console.error('Error saving custom category:', error);
    return false;
  }
};

export const getCustomCategories = async (): Promise<string[]> => {
  try {
    const customCategoriesJson = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    return customCategoriesJson ? JSON.parse(customCategoriesJson) : [];
  } catch (error) {
    console.error('Error loading custom categories:', error);
    return [];
  }
};
