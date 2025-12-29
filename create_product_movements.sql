CREATE TABLE IF NOT EXISTS productMovements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  productId INT NOT NULL,
  date TIMESTAMP NOT NULL,
  type ENUM('ENTRADA', 'SAIDA', 'PERDA', 'ACERTO', 'ESTORNO') NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  documentNumber VARCHAR(100),
  userId VARCHAR(64) NOT NULL,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX product_idx (productId),
  INDEX date_idx (date),
  INDEX type_idx (type)
);
