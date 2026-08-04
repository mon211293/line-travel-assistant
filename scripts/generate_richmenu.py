from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 2500, 843
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"

image = Image.new("RGB", (WIDTH, HEIGHT), (23, 108, 74))
draw = ImageDraw.Draw(image)

symbol_font = ImageFont.truetype(FONT_PATH, 260)
label_font = ImageFont.truetype(FONT_PATH, 120)

center_x = WIDTH // 2

symbol = "✈"
symbol_bbox = draw.textbbox((0, 0), symbol, font=symbol_font)
symbol_w = symbol_bbox[2] - symbol_bbox[0]
symbol_h = symbol_bbox[3] - symbol_bbox[1]
draw.text(
    (center_x - symbol_w / 2 - symbol_bbox[0], HEIGHT * 0.35 - symbol_h / 2 - symbol_bbox[1]),
    symbol,
    font=symbol_font,
    fill=(255, 255, 255),
)

label = "行程設定"
label_bbox = draw.textbbox((0, 0), label, font=label_font)
label_w = label_bbox[2] - label_bbox[0]
label_h = label_bbox[3] - label_bbox[1]
draw.text(
    (center_x - label_w / 2 - label_bbox[0], HEIGHT * 0.72 - label_h / 2 - label_bbox[1]),
    label,
    font=label_font,
    fill=(255, 255, 255),
)

image.save("richmenu.png")
print("saved", image.size)
