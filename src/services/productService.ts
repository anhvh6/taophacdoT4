import { mockDB } from '../lib/mockData';
import { Product } from '../../types';

export const productService = {
  async getProducts() {
    const products = await mockDB.getProducts();
    products.sort((a, b) => a.ten_sp.localeCompare(b.ten_sp));
    return products;
  },

  async upsertProduct(product: Partial<Product>) {
    const products = await mockDB.getProducts();
    const idx = products.findIndex(p => p.id_sp === product.id_sp);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...product } as Product;
    } else {
      products.push(product as Product);
    }
    await mockDB.saveProducts(products);
    return product as Product;
  },

  async deleteProduct(id: string) {
    const products = await mockDB.getProducts();
    const newProducts = products.filter(p => p.id_sp !== id);
    await mockDB.saveProducts(newProducts);
    return true;
  }
};
