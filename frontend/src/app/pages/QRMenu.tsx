import { useSearchParams } from "react-router";
import { useState, useEffect, useMemo } from "react";
import { menuApi, ordersApi, inventoryApi } from "../api/services";
import type { MenuItem, InventoryItem } from "../types";
import { buildInventoryMap, isItemOutOfStock } from "../../shared/utils/inventoryAvailability";

export function MenuQR() {

    const [params] = useSearchParams();
    const table = params.get("table");
    const accountIdParam = params.get("accountId");

    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [openItem, setOpenItem] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [cart, setCart] = useState<Array<MenuItem & { quantity: number }>>([]);
    const [showCart, setShowCart] = useState(false);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const inventoryMap = useMemo(() => buildInventoryMap(inventoryItems), [inventoryItems]);

    useEffect(() => {
        menuApi.list({ available: 'true', ...(accountIdParam ? { accountId: accountIdParam } : {}) }).then(setMenuItems).catch(console.error);
        inventoryApi.list().then((inv) => setInventoryItems(Array.isArray(inv) ? inv : [])).catch(() => setInventoryItems([]));
    }, [accountIdParam]);


    const addToCart = (item: MenuItem) => {

        const existing = cart.find(i => i.id === item.id);

        if (existing) {
            setCart(cart.map(i =>
                i.id === item.id
                    ? { ...i, quantity: i.quantity + quantity }
                    : i
            ));
        } else {
            setCart([
                ...cart,
                {
                    ...item,
                    quantity: quantity
                }
            ]);
        }

        setOpenItem(null);
        setQuantity(1);
    };
    const submitOrder = async () => {

        try {

            const order = {
                table: table,
                items: cart.map(i => ({
                    itemId: i.id,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity
                })),
                total: totalPrice,
                status: "pending",
                time: new Date().toISOString()
            };

            await ordersApi.create({
                table: Number(table),
                items: order.items,
                time: order.time,
            });

            alert("Đặt món thành công");

            setCart([]);
            setShowCart(false);

        } catch (err) {

            console.error("Submit order error:", err);
            alert("Không gửi được order");

        }

    };


    const totalPrice = cart.reduce((sum, item) => {
        return sum + item.price * item.quantity;
    }, 0);

    return (
        <div className="p-4 max-w-md mx-auto">

            <h1 className="text-2xl font-bold mb-4 text-center">
                Menu - Bàn {table}
            </h1>

            {/* MENU LIST */}
            <div className="space-y-3">

                {menuItems.map(item => {
                    const outOfStock = isItemOutOfStock(item, inventoryMap);
                    return (

                    <div key={item.id} className="border rounded-lg relative">

                        <div
                            onClick={outOfStock ? undefined : () => {
                                setOpenItem(openItem === item.id ? null : item.id);
                                setQuantity(1);
                            }}
                            className={`flex justify-between items-center p-4 ${outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                        >

                            <div>
                                <div className="font-semibold">
                                    {item.name}
                                </div>

                                <div className="text-gray-500 text-sm">
                                    {item.category}
                                </div>
                            </div>

                            <div className="text-blue-600 font-bold">
                                {item.price.toLocaleString()} ₫
                            </div>

                        </div>

                        {outOfStock && (
                            <div className="absolute top-2 right-2 pointer-events-none">
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold shadow">
                                    Hết nguyên liệu
                                </span>
                            </div>
                        )}

                        {/* COLLAPSE */}

                        {openItem === item.id && !outOfStock && (

                            <div className="p-4 border-t bg-gray-50">

                                <div className="flex items-center justify-center gap-4 mb-3">

                                    <button
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        className="w-8 h-8 bg-gray-200 rounded"
                                    >
                                        -
                                    </button>

                                    <div className="text-lg font-bold w-10 text-center">
                                        {quantity}
                                    </div>

                                    <button
                                        onClick={() => setQuantity(q => q + 1)}
                                        className="w-8 h-8 bg-gray-200 rounded"
                                    >
                                        +
                                    </button>

                                </div>

                                <button
                                    onClick={() => addToCart(item)}
                                    className="w-full bg-blue-600 text-white py-2 rounded"
                                >
                                    Thêm vào order
                                </button>

                            </div>

                        )}

                    </div>
                    );
                })}


            </div>

            {/* POPUP CHỌN SỐ LƯỢNG */}

            {cart.length > 0 && (

                <div
                    onClick={() => setShowCart(true)}
                    className="fixed bottom-0 left-0 right-0 bg-green-600 text-white p-4 flex justify-between items-center cursor-pointer"
                >

                    <div className="font-bold">
                        {cart.length} món
                    </div>

                    <div className="font-bold">
                        Xem Order
                    </div>

                </div>

            )}
            {showCart && (

                <div className="fixed inset-0 bg-black/40 flex items-end">

                    <div className="bg-white w-full p-4 rounded-t-2xl max-h-[70vh] overflow-auto">

                        <div className="flex justify-between items-center mb-4">

                            <h2 className="font-bold text-lg">
                                Order của bạn
                            </h2>

                            <button
                                onClick={() => setShowCart(false)}
                                className="text-red-500"
                            >
                                Đóng
                            </button>

                        </div>

                        <div className="space-y-2">

                            {cart.map(i => (

                                <div
                                    key={i.id}
                                    className="flex justify-between"
                                >

                                    <div>
                                        {i.name} x{i.quantity}
                                    </div>

                                    <div className="font-semibold">
                                        {(i.price * i.quantity).toLocaleString()} ₫
                                    </div>



                                </div>

                            ))}
                            <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg">

                                <div>Tổng</div>

                                <div>
                                    {totalPrice.toLocaleString()} ₫
                                </div>

                            </div>
                        </div>

                        <button
                            onClick={submitOrder}
                            className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-bold"
                        >
                            Đặt Order
                        </button>

                    </div>

                </div>

            )}

        </div>
    );
}
