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


-- 添加点赞字段，默认 0
ALTER TABLE fishes
ADD COLUMN likes INTEGER DEFAULT 0;

-- 添加不点赞字段，默认 0
ALTER TABLE fishes
ADD COLUMN dislikes INTEGER DEFAULT 0;
