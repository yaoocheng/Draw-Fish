-- 创建用户表
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    fish_id INTEGER UNIQUE,
    FOREIGN KEY (fish_id) REFERENCES fishes(fish_id) ON DELETE CASCADE
);

-- 创建鱼表
CREATE TABLE fishes (
    fish_id SERIAL PRIMARY KEY,
    artist_name VARCHAR(255) NOT NULL,
    image_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
